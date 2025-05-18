/**
  @file Utility for fixing problem with extra digits in floating-point numbers (on CPUs which use IEEE-754).
  @author Dmitry Bondarenko <dmitry.bond.real@gmail.com>
  @version 20250517.1212

  Note: 'fp' - is short from 'floating-point'

  You can use maintain one set of entities descriptors for whole application project.
  Or you can define small sub-sets of entities descriptors inside API consumer source file.
  Just choose which is more suitable for your situation.

  @example
  const fpFixerCtx: FpFixerContext = {
    entities: {
      //--- db-related definitions - scale + field names which use this scale
      "PRDSPC": [
        { "scale": 2, "names": ["packageSize"] },
        { "scale": 3, "names": ["unitHeight", "unitWidth", "unitDepth", "trayHeight", "trayWidth", "trayDepth"] }
      ],

      "PRDSPCMN": [
        { "scale": 3, "names": ["caseHeight", "caseWidth", "caseDepth", "displayHeight", "displayWidth", "displayDepth", "jumbleFactor", "marketShare"] }
      ],

      // --- reusable definitions of any custom objects
      productObj: [
        { scale: 3, names: ['targetGm', 'shrinkRate'] }
      ],
      currencyObj: [
        { scale: 3, names: ['curr999'] }
      ],
      casepackObj: [
        { scale: 3, names: ['caseWidth', 'caseHeight', 'caseCube', 'caseGrossWgt'] }
      ],
      costObj: [
        { scale: 3, names: ['prdCost'] }
      ],
      costLinkObj: [
        { scale: 3, names: ['prdCost'] }
      ],

      // --- API-related definitions REST responses
      getSpaceManagement: [{ entityRef: 'PRDSPC' }],
      getProductSpecifications: [{ entityRef: 'PRDSPCMN1' }],
      casePackMetadata: [
        { entityRef: 'productObj' },
        { entityRef: 'currencyObj', names: ['currency'] },
      ],
      casePackDetail: [
        { entityRef: 'casepackObj' },
        { entityRef: 'productObj', names: ['product'] },
        { entityRef: 'costObj', names: ['cost'] },
        { entityRef: 'costLinkObj', names: ['costLinkRecord'] },
      ],
    }
  }

  // [...] just after received response from API call
  fixFpFields(rec.data.data, fpFixerCtx, 'getSpaceManagement')
  // ...or 
  fixFpFields(rec.data.product, fpFixerCtx, 'casePackMetadata')
  // ...or 
  fixFpFields(rec.data, fpFixerCtx, 'casePackDetail')
  
*/


/**
 * Descriptor on how to fix fp-fields - what scale apply to what fields
 */
export interface FpFieldDescriptor {
  // variant 1 - scale + list of fields to fix (using specified scale)
  scale?: number
  names?: string[]

  // variant 2 - ref to other entity
  entityRef?: string
}

/**
 * Descriptor of all objects/entities which need fp-numbers fixed
 */
export interface FpFixerCfgDescriptor {
  [name: string]: FpFieldDescriptor[]
}


/**
 * Context for calling fixFpFields() function.
 * It may have explicit config definitions - how to fix fp-fields in object.
 * Or it may have entities definitions in addition.
 */
export interface FpFixerContext {
  // option 1 (simplified) - just explicit definitions on how to fix fp-fields in object
  config?: FpFieldDescriptor[]

  // option 2 - additional definitions for entities (to fix fp-values in sub-objects)
  entities?: FpFixerCfgDescriptor
}


/**
 * Max level of recursion of in fixFpFields() calls.
 */
export let MAX_FP_FIXER_RECURSION: number = 10


/**
 * Fix fp-number to remove extra scale digits (using number-to-string-to-number).
 * @return fixed fp-number
 */
export const fixFp = (x: number, scale: number) => {
  return parseFloat(x.toFixed(scale))
}


/**
 * Fix fp-number to remove extra scale digits (using math).
 * @return fixed fp-number
 */
export const fixFp2 = (x: number, scale: number) => {
  // 10th = 10.000.000.000 
  const factors = [1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000, 1000000000, 10000000000]
  const f = factors[scale]
  return Math.ceil(x * f) / f
}


/**
 * Find fixer config for specified entity.
 * Note: it tries name as-is first and then the same name upper-cased when 1st variant was not found.
 * @param {object} ctx - context object 
 * @param {string} entityName - name of entity to find fixer config for
 * @returns fixer config - array of fp-fixer definitions or undefined when not found
*/
export const getFpFixerCfg = (ctx: FpFixerContext, entityName: string): FpFieldDescriptor[] | undefined => {
  if (!ctx.entities) return undefined
  let result = ctx.entities[entityName]
  if (!result) {
    result = ctx.entities[entityName.toUpperCase()]
  }
  if (!result) {
    console.error(`ERR: [${entityName}] entity is not found within [${Object.keys(ctx.entities).length} items: ${Object.keys(ctx.entities).join(',')}]`)
  }
  return result
}

/**
 * Loop over fp-fields in fp-fixer definitions and fix appropriate fields rec according to definitions.
 * Note: it also supports arrays of objects (auto-recognized).
 * @param {object} rec - object in which fp-values should be fixed.
 * @param {FpFieldDescriptor[]} fpCfg - fp-fixer definitions.
 */
export const fixFpFields = (rec: any, ctx: FpFixerContext, entityName?: string) => {
  fixFpFieldsImpl(rec, ctx, entityName, 0)
}

const fixFpFieldsImpl = (rec: any, ctx: FpFixerContext, entityName?: string, rcrLvl: number=0) => {
  if (!rec) return 
  if (!ctx) return //throw 'FP-Fixer config is not specified'

  //console.log(`---fpFixer[${entityName}/lvl=${rcrLvl}/${Array.isArray(rec) ? 'array' : 'object'}/cfg=${ctx.config}/ent=${ctx.entities}]: `) //, rec)
  //DBG: console.debug(JSON.stringify(rec))

  if (rcrLvl > MAX_FP_FIXER_RECURSION) throw `FP-Fixer - recursion overflow (${rcrLvl})`

  if (Array.isArray(rec)) {
    for (let item of rec) {
      fixFpFieldsImpl(item, ctx, entityName, rcrLvl)
    }
    return
  }

  let localCtx: FpFixerContext = { entities:ctx.entities, config:ctx.config }
  //console.log(localCtx)

  // 1. processing fp-field values
  let fpCfg = localCtx.config
  if (!fpCfg && entityName) 
    fpCfg = getFpFixerCfg(localCtx, entityName)
  if (!fpCfg) {
    console.error(`ERR: FpFixer[${entityName}/lvl=${rcrLvl}]: no definitions!`)
    return 
  }
  for (const cfgItem of fpCfg) {
    //DBG: if (rcrLvl > 0) console.log(cfgItem)
    if (cfgItem.entityRef) continue;
    if (cfgItem.scale && cfgItem.names) {
      for (const name of cfgItem.names) {
        if (rec[name]) {
          rec[name] = fixFp(rec[name], cfgItem.scale) 
          //console.log(`\tfp-fix[${name}] = ${rec[name]}`)
        }
      }
    }
  }

  // 2. processing refs to other entities
  for (const cfgItem of fpCfg) {
    if (cfgItem.entityRef) {
      localCtx.config = getFpFixerCfg(localCtx, cfgItem.entityRef)
      if (localCtx.config) {
        // when names specified - apply entityName only to specified fields
        if (cfgItem.names) {
          for (const name of cfgItem.names) {
            fixFpFieldsImpl(rec[name], localCtx, cfgItem.entityRef, rcrLvl + 1)
          }
        }
        // ...otherwise - apply to current value
        else {
          fixFpFieldsImpl(rec, localCtx, cfgItem.entityRef, rcrLvl + 1)
        }        
      }
      else {
        console.error(`ERR: FpFixer[${entityName}/lvl=${rcrLvl}]->${cfgItem.entityRef}: no definitions!`)
      }
    }
  }
}
