import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

/**
 * Smart Nuxt/Vite patcher used by demo resolution tooling.
 *
 * Purpose:
 * - keep link-mode compatibility config in sync with selected InstantDB
 *   dependency mode for any targeted demo
 *
 * Behavior:
 * - `links` mode ensures:
 *   - `vite.resolve.preserveSymlinks = true`
 *   - `vite.optimizeDeps.exclude` contains `@mszr/idb-dux`
 * - non-`links` modes remove only those link-mode additions
 *
 * Safety/cleanup rules:
 * - only removes owned keys (`preserveSymlinks`, `@mszr/idb-dux` exclude entry)
 * - prunes empty containers (`resolve`, `optimizeDeps`, and `vite` on nuxt config)
 * - preserves exported vite objects in external files so imports do not break
 *
 * Supported config shapes:
 * - inline `vite: { ... }` in `defineNuxtConfig`
 * - local identifier references (`const vite = { ... }`, then `vite`)
 * - named import/re-export chains (`nuxt.config` -> index -> vite module)
 */
const LINK_MODE_OPTIMIZE_DEPS_EXCLUDES = ['@mszr/idb-dux']
const EXPORT_RESOLUTION_NOT_FOUND = 'IDB_VUE_EXPORT_RESOLUTION_NOT_FOUND'

function scriptKindFromPath(filePath) {
  if (filePath.endsWith('.mts'))
    return ts.ScriptKind.TS
  if (filePath.endsWith('.cts'))
    return ts.ScriptKind.TS
  if (filePath.endsWith('.ts'))
    return ts.ScriptKind.TS
  if (filePath.endsWith('.mjs'))
    return ts.ScriptKind.JS
  if (filePath.endsWith('.cjs'))
    return ts.ScriptKind.JS
  if (filePath.endsWith('.js'))
    return ts.ScriptKind.JS
  return ts.ScriptKind.Unknown
}

function readSourceFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  const scriptKind = scriptKindFromPath(filePath)
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, scriptKind)
  return { sourceFile, text }
}

function printNode(node, sourceFile) {
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })
  return printer.printNode(ts.EmitHint.Unspecified, node, sourceFile)
}

function replaceTextRange(sourceText, start, end, replacement) {
  return `${sourceText.slice(0, start)}${replacement}${sourceText.slice(end)}`
}

function replaceObjectLiteralInFile(filePath, objectLiteralNode, updatedObjectLiteralNode, sourceFile, sourceText) {
  const replacement = printNode(updatedObjectLiteralNode, sourceFile)
  const start = objectLiteralNode.getStart(sourceFile)
  const end = objectLiteralNode.getEnd()
  const nextText = replaceTextRange(sourceText, start, end, replacement)

  if (nextText === sourceText)
    return false

  fs.writeFileSync(filePath, nextText)
  return true
}

function unwrapExpression(expression) {
  let current = expression

  while (true) {
    if (ts.isParenthesizedExpression(current)) {
      current = current.expression
      continue
    }

    if (ts.isAsExpression(current)) {
      current = current.expression
      continue
    }

    if (ts.isSatisfiesExpression(current)) {
      current = current.expression
      continue
    }

    return current
  }
}

function getPropertyNameText(name) {
  if (ts.isIdentifier(name))
    return name.text
  if (ts.isStringLiteral(name))
    return name.text
  if (ts.isNumericLiteral(name))
    return name.text
  if (ts.isComputedPropertyName(name) && ts.isStringLiteral(name.expression))
    return name.expression.text
  return null
}

function findObjectProperty(objectLiteral, key) {
  for (const property of objectLiteral.properties) {
    if (
      ts.isPropertyAssignment(property)
      || ts.isShorthandPropertyAssignment(property)
      || ts.isMethodDeclaration(property)
      || ts.isGetAccessorDeclaration(property)
      || ts.isSetAccessorDeclaration(property)
    ) {
      const name = getPropertyNameText(property.name)
      if (name === key)
        return property
    }
  }

  return null
}

function upsertObjectProperty(objectLiteral, key, initializer) {
  const existing = findObjectProperty(objectLiteral, key)

  if (existing && ts.isPropertyAssignment(existing)) {
    const nextProperty = ts.factory.updatePropertyAssignment(existing, existing.name, initializer)
    const nextProperties = objectLiteral.properties.map(property => property === existing ? nextProperty : property)
    return ts.factory.updateObjectLiteralExpression(objectLiteral, nextProperties)
  }

  if (existing && ts.isShorthandPropertyAssignment(existing)) {
    const nextProperty = ts.factory.createPropertyAssignment(existing.name, initializer)
    const nextProperties = objectLiteral.properties.map(property => property === existing ? nextProperty : property)
    return ts.factory.updateObjectLiteralExpression(objectLiteral, nextProperties)
  }

  return ts.factory.updateObjectLiteralExpression(objectLiteral, [...objectLiteral.properties, ts.factory.createPropertyAssignment(key, initializer)])
}

function removeObjectProperty(objectLiteral, key) {
  const nextProperties = objectLiteral.properties.filter((property) => {
    if (
      ts.isPropertyAssignment(property)
      || ts.isShorthandPropertyAssignment(property)
      || ts.isMethodDeclaration(property)
      || ts.isGetAccessorDeclaration(property)
      || ts.isSetAccessorDeclaration(property)
    ) {
      const name = getPropertyNameText(property.name)
      return name !== key
    }

    return true
  })

  return ts.factory.updateObjectLiteralExpression(objectLiteral, nextProperties)
}

function isEmptyObjectLiteral(objectLiteral) {
  return objectLiteral.properties.length === 0
}

function ensureStringInArrayLiteral(arrayLiteral, value) {
  const alreadyPresent = arrayLiteral.elements.some((element) => {
    return ts.isStringLiteral(element) && element.text === value
  })

  if (alreadyPresent)
    return arrayLiteral

  return ts.factory.updateArrayLiteralExpression(arrayLiteral, [
    ...arrayLiteral.elements,
    ts.factory.createStringLiteral(value),
  ])
}

function removeStringFromArrayLiteral(arrayLiteral, value) {
  const nextElements = arrayLiteral.elements.filter((element) => {
    return !(ts.isStringLiteral(element) && element.text === value)
  })

  if (nextElements.length === arrayLiteral.elements.length)
    return arrayLiteral

  return ts.factory.updateArrayLiteralExpression(arrayLiteral, nextElements)
}

function applyLinkModeViteConfig(viteObjectLiteral, shouldEnable) {
  let nextVite = viteObjectLiteral

  const resolveProperty = findObjectProperty(nextVite, 'resolve')
  const resolveInitializer = resolveProperty && ts.isPropertyAssignment(resolveProperty)
    ? unwrapExpression(resolveProperty.initializer)
    : null

  if (shouldEnable) {
    const baseResolve = resolveInitializer && ts.isObjectLiteralExpression(resolveInitializer)
      ? resolveInitializer
      : ts.factory.createObjectLiteralExpression([], true)

    const nextResolve = upsertObjectProperty(baseResolve, 'preserveSymlinks', ts.factory.createTrue())
    nextVite = upsertObjectProperty(nextVite, 'resolve', nextResolve)
  }

  if (!shouldEnable && resolveInitializer && ts.isObjectLiteralExpression(resolveInitializer)) {
    const nextResolve = removeObjectProperty(resolveInitializer, 'preserveSymlinks')

    if (isEmptyObjectLiteral(nextResolve))
      nextVite = removeObjectProperty(nextVite, 'resolve')
    else
      nextVite = upsertObjectProperty(nextVite, 'resolve', nextResolve)
  }

  const optimizeDepsProperty = findObjectProperty(nextVite, 'optimizeDeps')
  const optimizeDepsInitializer = optimizeDepsProperty && ts.isPropertyAssignment(optimizeDepsProperty)
    ? unwrapExpression(optimizeDepsProperty.initializer)
    : null

  const baseOptimizeDeps = optimizeDepsInitializer && ts.isObjectLiteralExpression(optimizeDepsInitializer)
    ? optimizeDepsInitializer
    : ts.factory.createObjectLiteralExpression([], true)

  if (shouldEnable && optimizeDepsInitializer && !ts.isObjectLiteralExpression(optimizeDepsInitializer)) {
    throw new Error(
      'Found non-object `vite.optimizeDeps` in nuxt config. Please make it an object so link-mode automation can manage optimizeDeps.exclude.',
    )
  }

  const excludeProperty = findObjectProperty(baseOptimizeDeps, 'exclude')
  const excludeInitializer = excludeProperty && ts.isPropertyAssignment(excludeProperty)
    ? unwrapExpression(excludeProperty.initializer)
    : null

  if (shouldEnable) {
    let nextExclude
    if (excludeInitializer && ts.isArrayLiteralExpression(excludeInitializer)) {
      nextExclude = excludeInitializer
      for (const depName of LINK_MODE_OPTIMIZE_DEPS_EXCLUDES) {
        nextExclude = ensureStringInArrayLiteral(nextExclude, depName)
      }
    }
    else if (!excludeInitializer) {
      nextExclude = ts.factory.createArrayLiteralExpression(
        LINK_MODE_OPTIMIZE_DEPS_EXCLUDES.map(depName => ts.factory.createStringLiteral(depName)),
        true,
      )
    }
    else {
      throw new Error(
        'Found non-array `vite.optimizeDeps.exclude` in nuxt config. Please make it an array so link-mode automation can manage it.',
      )
    }

    const nextOptimizeDeps = upsertObjectProperty(baseOptimizeDeps, 'exclude', nextExclude)
    nextVite = upsertObjectProperty(nextVite, 'optimizeDeps', nextOptimizeDeps)
    return nextVite
  }

  if (optimizeDepsInitializer && ts.isObjectLiteralExpression(optimizeDepsInitializer)) {
    let nextOptimizeDeps = optimizeDepsInitializer

    if (excludeInitializer && ts.isArrayLiteralExpression(excludeInitializer)) {
      let nextExclude = excludeInitializer
      for (const depName of LINK_MODE_OPTIMIZE_DEPS_EXCLUDES) {
        nextExclude = removeStringFromArrayLiteral(nextExclude, depName)
      }

      if (nextExclude.elements.length === 0)
        nextOptimizeDeps = removeObjectProperty(nextOptimizeDeps, 'exclude')
      else
        nextOptimizeDeps = upsertObjectProperty(nextOptimizeDeps, 'exclude', nextExclude)
    }

    if (isEmptyObjectLiteral(nextOptimizeDeps))
      nextVite = removeObjectProperty(nextVite, 'optimizeDeps')
    else
      nextVite = upsertObjectProperty(nextVite, 'optimizeDeps', nextOptimizeDeps)
  }

  return nextVite
}

function resolveImportPath(fromFilePath, importSpecifier) {
  const basePath = path.resolve(path.dirname(fromFilePath), importSpecifier)
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.mts`,
    `${basePath}.cts`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    `${basePath}.cjs`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.mts'),
    path.join(basePath, 'index.cts'),
    path.join(basePath, 'index.js'),
    path.join(basePath, 'index.mjs'),
    path.join(basePath, 'index.cjs'),
  ]

  return candidates.find((candidate) => {
    if (fs.existsSync(candidate) === false)
      return false

    return fs.statSync(candidate).isFile()
  }) ?? null
}

function relativePathFromVueRoot(vueRoot, filePath) {
  return path.relative(vueRoot, filePath) || filePath
}

function formatResolutionTrace(trace) {
  if (!trace || trace.length === 0)
    return ''
  const lines = trace.map(step => `  - ${step}`)
  return `\nResolution trace:\n${lines.join('\n')}`
}

function createExportResolutionNotFoundError(message) {
  const error = new Error(message)
  error.code = EXPORT_RESOLUTION_NOT_FOUND
  return error
}

function getModuleExportNameText(nameNode) {
  if (ts.isIdentifier(nameNode))
    return nameNode.text
  if (ts.isStringLiteral(nameNode))
    return nameNode.text
  return null
}

function findImportedSymbolSourceFile(sourceFile, fromFilePath, localIdentifierName, vueRoot) {
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) === false)
      continue

    if (statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier) === false)
      continue

    const importClause = statement.importClause
    if (!importClause)
      continue

    if (importClause.name?.text === localIdentifierName) {
      return {
        status: 'unsupported',
        reason: `Found default import '${localIdentifierName}' in ${relativePathFromVueRoot(vueRoot, fromFilePath)}. Only named imports are supported for vite config tracing.`,
      }
    }

    const namedBindings = importClause.namedBindings
    if (!namedBindings)
      continue

    if (ts.isNamespaceImport(namedBindings)) {
      if (namedBindings.name.text === localIdentifierName) {
        return {
          status: 'unsupported',
          reason: `Found namespace import '${localIdentifierName}' in ${relativePathFromVueRoot(vueRoot, fromFilePath)}. Namespace imports are not supported for vite config tracing.`,
        }
      }

      continue
    }

    if (ts.isNamedImports(namedBindings) === false)
      continue

    for (const specifier of namedBindings.elements) {
      const localName = specifier.name.text
      if (localName !== localIdentifierName)
        continue

      const importedName = specifier.propertyName ? specifier.propertyName.text : specifier.name.text
      const modulePath = resolveImportPath(fromFilePath, statement.moduleSpecifier.text)

      if (!modulePath) {
        return {
          status: 'unsupported',
          reason: `Could not resolve import path '${statement.moduleSpecifier.text}' from ${relativePathFromVueRoot(vueRoot, fromFilePath)} while tracing '${localIdentifierName}'.`,
        }
      }

      return {
        status: 'resolved',
        filePath: modulePath,
        exportedName: importedName,
      }
    }
  }

  return {
    status: 'not_found',
  }
}

function findVariableObjectLiteral(sourceFile, variableName, options = {}) {
  const { exportedOnly = false } = options

  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement) === false)
      continue

    const isExported = statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
    if (exportedOnly && !isExported)
      continue

    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) === false)
        continue
      if (declaration.name.text !== variableName)
        continue
      if (!declaration.initializer)
        continue

      const unwrapped = unwrapExpression(declaration.initializer)
      if (ts.isObjectLiteralExpression(unwrapped))
        return unwrapped
    }
  }

  return null
}

function findExportedObjectLiteral(sourceFile, exportedName) {
  return findVariableObjectLiteral(sourceFile, exportedName, { exportedOnly: true })
}

function resolveExportedObjectLiteral(filePath, exportedName, vueRoot, context = {}) {
  const visited = context.visited ?? new Set()
  const trace = context.trace ?? []
  const step = `${relativePathFromVueRoot(vueRoot, filePath)} -> export '${exportedName}'`
  const nextTrace = [...trace, step]
  const visitKey = `${filePath}::${exportedName}`

  if (visited.has(visitKey)) {
    throw new Error(
      `Detected circular import/export chain while resolving '${exportedName}'.${formatResolutionTrace(nextTrace)}`,
    )
  }

  visited.add(visitKey)

  const { sourceFile, text } = readSourceFile(filePath)
  const directExportedObject = findExportedObjectLiteral(sourceFile, exportedName)
  if (directExportedObject) {
    return {
      filePath,
      sourceFile,
      sourceText: text,
      objectLiteral: directExportedObject,
      trace: nextTrace,
    }
  }

  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement) === false)
      continue

    if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const specifier of statement.exportClause.elements) {
        const exportedText = getModuleExportNameText(specifier.name)
        if (exportedText !== exportedName)
          continue

        const localOrImportedName = specifier.propertyName
          ? getModuleExportNameText(specifier.propertyName)
          : exportedText

        if (!localOrImportedName) {
          throw new Error(
            `Unsupported export specifier while resolving '${exportedName}' in ${relativePathFromVueRoot(vueRoot, filePath)}.${formatResolutionTrace(nextTrace)}`,
          )
        }

        if (statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
          const targetPath = resolveImportPath(filePath, statement.moduleSpecifier.text)
          if (!targetPath) {
            throw new Error(
              `Could not resolve re-export source '${statement.moduleSpecifier.text}' from ${relativePathFromVueRoot(vueRoot, filePath)}.${formatResolutionTrace(nextTrace)}`,
            )
          }

          return resolveExportedObjectLiteral(targetPath, localOrImportedName, vueRoot, {
            visited,
            trace: nextTrace,
          })
        }

        const localObjectLiteral = findVariableObjectLiteral(sourceFile, localOrImportedName)
        if (localObjectLiteral) {
          return {
            filePath,
            sourceFile,
            sourceText: text,
            objectLiteral: localObjectLiteral,
            trace: [...nextTrace, `${relativePathFromVueRoot(vueRoot, filePath)} -> local '${localOrImportedName}'`],
          }
        }

        const imported = findImportedSymbolSourceFile(sourceFile, filePath, localOrImportedName, vueRoot)
        if (imported.status === 'resolved') {
          return resolveExportedObjectLiteral(imported.filePath, imported.exportedName, vueRoot, {
            visited,
            trace: [...nextTrace, `${relativePathFromVueRoot(vueRoot, filePath)} -> imported '${localOrImportedName}'`],
          })
        }

        if (imported.status === 'unsupported') {
          throw new Error(
            `${imported.reason}${formatResolutionTrace(nextTrace)}`,
          )
        }

        throw new Error(
          `Could not resolve local export alias '${localOrImportedName}' for '${exportedName}' in ${relativePathFromVueRoot(vueRoot, filePath)}.${formatResolutionTrace(nextTrace)}`,
        )
      }
    }

    if (
      statement.moduleSpecifier
      && ts.isStringLiteral(statement.moduleSpecifier)
      && !statement.exportClause
    ) {
      const targetPath = resolveImportPath(filePath, statement.moduleSpecifier.text)
      if (!targetPath) {
        throw new Error(
          `Could not resolve export-all source '${statement.moduleSpecifier.text}' from ${relativePathFromVueRoot(vueRoot, filePath)}.${formatResolutionTrace(nextTrace)}`,
        )
      }

      try {
        return resolveExportedObjectLiteral(targetPath, exportedName, vueRoot, {
          visited,
          trace: nextTrace,
        })
      }
      catch (error) {
        if (error?.code !== EXPORT_RESOLUTION_NOT_FOUND)
          throw error
      }
    }
  }

  throw createExportResolutionNotFoundError(
    `Unable to resolve exported object literal '${exportedName}' from ${relativePathFromVueRoot(vueRoot, filePath)}. Supported patterns include direct exported object literals and named re-exports.${formatResolutionTrace(nextTrace)}`,
  )
}

function findNuxtConfigObjectLiteral(sourceFile) {
  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement) === false)
      continue

    const expression = statement.expression
    if (ts.isCallExpression(expression) === false)
      continue
    if (ts.isIdentifier(expression.expression) === false)
      continue
    if (expression.expression.text !== 'defineNuxtConfig')
      continue
    if (expression.arguments.length === 0)
      continue

    const configArgument = expression.arguments[0]
    const unwrapped = unwrapExpression(configArgument)

    if (ts.isObjectLiteralExpression(unwrapped))
      return unwrapped
  }

  return null
}

function findNuxtConfigFilePath(demoRoot) {
  const candidates = [
    'nuxt.config.ts',
    'nuxt.config.mts',
    'nuxt.config.cts',
    'nuxt.config.js',
    'nuxt.config.mjs',
    'nuxt.config.cjs',
  ]

  for (const candidate of candidates) {
    const fullPath = path.resolve(demoRoot, candidate)
    if (fs.existsSync(fullPath))
      return fullPath
  }

  return null
}

function ensureInlineViteConfig(nuxtObjectLiteral, shouldEnable) {
  if (shouldEnable === false)
    return { updatedNuxtObject: nuxtObjectLiteral, changed: false }

  const viteObject = ts.factory.createObjectLiteralExpression([
    ts.factory.createPropertyAssignment(
      'resolve',
      ts.factory.createObjectLiteralExpression([
        ts.factory.createPropertyAssignment('preserveSymlinks', ts.factory.createTrue()),
      ], true),
    ),
    ts.factory.createPropertyAssignment(
      'optimizeDeps',
      ts.factory.createObjectLiteralExpression([
        ts.factory.createPropertyAssignment(
          'exclude',
          ts.factory.createArrayLiteralExpression(
            LINK_MODE_OPTIMIZE_DEPS_EXCLUDES.map(depName => ts.factory.createStringLiteral(depName)),
            true,
          ),
        ),
      ], true),
    ),
  ], true)

  const updatedNuxtObject = upsertObjectProperty(nuxtObjectLiteral, 'vite', viteObject)
  return {
    updatedNuxtObject,
    changed: printNode(updatedNuxtObject, nuxtObjectLiteral.getSourceFile()) !== printNode(nuxtObjectLiteral, nuxtObjectLiteral.getSourceFile()),
  }
}

function formatFilesWithWorkspaceEslint(vueRoot, filePaths) {
  const uniqueFilePaths = [...new Set(filePaths)].filter(filePath => fs.existsSync(filePath))
  if (uniqueFilePaths.length === 0)
    return

  const relativeFilePaths = uniqueFilePaths.map(filePath => path.relative(vueRoot, filePath))
  const eslintArgs = [
    '--dir',
    vueRoot,
    'exec',
    'eslint',
    ...relativeFilePaths,
    '--fix',
    '--config',
    'eslint.config.mjs',
  ]

  const result = spawnSync('pnpm', eslintArgs, {
    cwd: vueRoot,
    stdio: 'pipe',
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].map(value => value?.trim()).filter(Boolean).join('\n')
    console.warn('[demo-idb-resolution] warning: eslint --fix failed for touched config files.')
    if (details)
      console.warn(details)
  }
}

/**
 * Applies or reverts link-mode Nuxt/Vite settings for a single demo.
 *
 * @param {object} param0 Destructured options object.
 * @param {string} param0.demoRoot Absolute path to the demo root (directory containing `package.json`).
 * @param {string} param0.mode Dependency resolution mode selected by the caller (`links`, `tarballs`, `npm`).
 * @param {string} param0.vueRoot Absolute path to `client/packages/vux` workspace root.
 * @returns Absolute file paths touched during patching (after optional eslint formatting).
 */
export function patchDemoLinkModeViteConfig({
  demoRoot,
  mode,
  vueRoot,
}) {
  const shouldEnable = mode === 'links'
  const touchedFilePaths = new Set()
  const markTouched = filePath => touchedFilePaths.add(filePath)
  const finish = () => {
    const touched = [...touchedFilePaths]
    formatFilesWithWorkspaceEslint(vueRoot, touched)
    return touched
  }

  const nuxtConfigFilePath = findNuxtConfigFilePath(demoRoot)

  if (!nuxtConfigFilePath) {
    return finish()
  }

  const { sourceFile: nuxtSourceFile, text: nuxtSourceText } = readSourceFile(nuxtConfigFilePath)
  const nuxtConfigObject = findNuxtConfigObjectLiteral(nuxtSourceFile)

  if (!nuxtConfigObject) {
    if (shouldEnable) {
      throw new Error(
        `Could not find an inline defineNuxtConfig({...}) object in ${relativePathFromVueRoot(vueRoot, nuxtConfigFilePath)}. Please configure vite.resolve.preserveSymlinks and vite.optimizeDeps.exclude manually for links mode.`,
      )
    }
    return finish()
  }

  const viteProperty = findObjectProperty(nuxtConfigObject, 'vite')

  if (!viteProperty) {
    const { updatedNuxtObject, changed } = ensureInlineViteConfig(nuxtConfigObject, shouldEnable)
    if (changed) {
      replaceObjectLiteralInFile(
        nuxtConfigFilePath,
        nuxtConfigObject,
        updatedNuxtObject,
        nuxtSourceFile,
        nuxtSourceText,
      )
      markTouched(nuxtConfigFilePath)
      console.log(`[demo-idb-resolution] nuxt config updated: ${path.relative(vueRoot, nuxtConfigFilePath)} (link-mode vite defaults)`)
    }
    return finish()
  }

  if (ts.isPropertyAssignment(viteProperty)) {
    const viteInitializer = unwrapExpression(viteProperty.initializer)

    if (ts.isObjectLiteralExpression(viteInitializer)) {
      const nextViteObject = applyLinkModeViteConfig(viteInitializer, shouldEnable)
      const currentPrinted = printNode(viteInitializer, nuxtSourceFile)
      const nextPrinted = printNode(nextViteObject, nuxtSourceFile)

      if (currentPrinted === nextPrinted)
        return finish()

      let changed = false
      if (shouldEnable === false && isEmptyObjectLiteral(nextViteObject)) {
        const nextNuxtConfigObject = removeObjectProperty(nuxtConfigObject, 'vite')
        changed = replaceObjectLiteralInFile(
          nuxtConfigFilePath,
          nuxtConfigObject,
          nextNuxtConfigObject,
          nuxtSourceFile,
          nuxtSourceText,
        )
      }
      else {
        changed = replaceObjectLiteralInFile(
          nuxtConfigFilePath,
          viteInitializer,
          nextViteObject,
          nuxtSourceFile,
          nuxtSourceText,
        )
      }

      if (changed) {
        markTouched(nuxtConfigFilePath)
        console.log(`[demo-idb-resolution] nuxt config updated: ${path.relative(vueRoot, nuxtConfigFilePath)} (inline vite)`)
      }
      return finish()
    }
  }

  const propertyInitializer = ts.isPropertyAssignment(viteProperty)
    ? unwrapExpression(viteProperty.initializer)
    : null
  const viteIdentifierName = ts.isShorthandPropertyAssignment(viteProperty)
    ? viteProperty.name.text
    : ts.isIdentifier(propertyInitializer)
      ? propertyInitializer.text
      : null

  if (viteIdentifierName) {
    const localObjectLiteral = findVariableObjectLiteral(nuxtSourceFile, viteIdentifierName)
    if (localObjectLiteral) {
      const nextViteObject = applyLinkModeViteConfig(localObjectLiteral, shouldEnable)
      const currentPrinted = printNode(localObjectLiteral, nuxtSourceFile)
      const nextPrinted = printNode(nextViteObject, nuxtSourceFile)
      if (currentPrinted === nextPrinted)
        return finish()

      const localChanged = replaceObjectLiteralInFile(
        nuxtConfigFilePath,
        localObjectLiteral,
        nextViteObject,
        nuxtSourceFile,
        nuxtSourceText,
      )

      if (localChanged) {
        markTouched(nuxtConfigFilePath)
        console.log(
          `[demo-idb-resolution] nuxt vite config updated: ${path.relative(vueRoot, nuxtConfigFilePath)} (${viteIdentifierName})`,
        )
      }

      const localObjectBecameEmpty = shouldEnable === false && isEmptyObjectLiteral(nextViteObject)
      if (localObjectBecameEmpty) {
        const { sourceFile: refreshedNuxtSourceFile, text: refreshedNuxtSourceText } = readSourceFile(nuxtConfigFilePath)
        const refreshedNuxtConfig = findNuxtConfigObjectLiteral(refreshedNuxtSourceFile)
        if (refreshedNuxtConfig && findObjectProperty(refreshedNuxtConfig, 'vite')) {
          const nextNuxtConfigObject = removeObjectProperty(refreshedNuxtConfig, 'vite')
          const nuxtChanged = replaceObjectLiteralInFile(
            nuxtConfigFilePath,
            refreshedNuxtConfig,
            nextNuxtConfigObject,
            refreshedNuxtSourceFile,
            refreshedNuxtSourceText,
          )

          if (nuxtChanged) {
            markTouched(nuxtConfigFilePath)
            console.log(
              `[demo-idb-resolution] nuxt config updated: ${path.relative(vueRoot, nuxtConfigFilePath)} (removed empty vite key)`,
            )
          }
        }
      }

      return finish()
    }

    const imported = findImportedSymbolSourceFile(
      nuxtSourceFile,
      nuxtConfigFilePath,
      viteIdentifierName,
      vueRoot,
    )

    if (imported.status === 'unsupported') {
      if (shouldEnable) {
        throw new Error(
          `${imported.reason}`,
        )
      }
      return finish()
    }

    if (imported.status === 'not_found') {
      if (shouldEnable) {
        throw new Error(
          `Found vite identifier '${viteIdentifierName}' in ${relativePathFromVueRoot(vueRoot, nuxtConfigFilePath)}, but could not resolve a matching named import.`,
        )
      }
      return finish()
    }

    let resolvedExport
    try {
      resolvedExport = resolveExportedObjectLiteral(imported.filePath, imported.exportedName, vueRoot, {
        trace: [
          `${relativePathFromVueRoot(vueRoot, nuxtConfigFilePath)} -> imported '${viteIdentifierName}'`,
        ],
      })
    }
    catch (error) {
      if (shouldEnable)
        throw error
      return finish()
    }

    const {
      filePath: resolvedFilePath,
      sourceFile: resolvedSourceFile,
      sourceText: resolvedSourceText,
      objectLiteral: exportedObjectLiteral,
    } = resolvedExport

    const nextViteObject = applyLinkModeViteConfig(exportedObjectLiteral, shouldEnable)
    const importedCurrentPrinted = printNode(exportedObjectLiteral, resolvedSourceFile)
    const importedNextPrinted = printNode(nextViteObject, resolvedSourceFile)
    if (importedCurrentPrinted === importedNextPrinted)
      return finish()

    const importedObjectBecameEmpty = isEmptyObjectLiteral(nextViteObject)

    const changed = replaceObjectLiteralInFile(
      resolvedFilePath,
      exportedObjectLiteral,
      nextViteObject,
      resolvedSourceFile,
      resolvedSourceText,
    )

    if (changed) {
      markTouched(resolvedFilePath)
      console.log(
        `[demo-idb-resolution] nuxt vite config updated: ${path.relative(vueRoot, resolvedFilePath)} (${imported.exportedName})`,
      )
    }

    if (shouldEnable === false && importedObjectBecameEmpty) {
      const nextNuxtConfigObject = removeObjectProperty(nuxtConfigObject, 'vite')
      const nuxtChanged = replaceObjectLiteralInFile(
        nuxtConfigFilePath,
        nuxtConfigObject,
        nextNuxtConfigObject,
        nuxtSourceFile,
        nuxtSourceText,
      )

      if (nuxtChanged) {
        markTouched(nuxtConfigFilePath)
        console.log(
          `[demo-idb-resolution] nuxt config updated: ${path.relative(vueRoot, nuxtConfigFilePath)} (removed empty vite key)`,
        )
      }
    }

    return finish()
  }

  if (shouldEnable) {
    throw new Error(
      `Found a non-object vite config in ${relativePathFromVueRoot(vueRoot, nuxtConfigFilePath)}. Please add vite.resolve.preserveSymlinks and vite.optimizeDeps.exclude manually for links mode.`,
    )
  }

  return finish()
}
