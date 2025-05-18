
# fp-fixer

Utility for fixing problem with extra digits in floating-point numbers (on CPUs which use IEEE-754).

___Note__: further flow 'fp' - is short from 'floating-point'._

Usually problem with extra digits in fp-numbers can be solved by calling ```.toFixed(N)``` where N is number of digits after fp.
But in case you application have lot of UI forms it could be a problem to maintain all the calls to ```.toFixed(N)``` even for one UI form.

Thus, idea is to fix all fp-numbers just after they received from server API.

How to fix fp-numbers described by TS types: ```FpFixerCfgDescriptor``` and ```FpFixerCfgDescriptor```.
And ```FpFixerContext``` TS type used to join both into a context for calling ```fixFpFields(...)``` function.

## Example 1. Simplified variant

You receiving from server response like this:

```
{
  "data": {
    "partNo": "DM8780-DRY-P0  ", 
    "uom": "100g",     
    "price": 9.9700002, 
    "caseWidth": 4.7250000000000005, 
    "caseHeight": 4.728000000000001, 
    "caseLen": 4.7210002,
    "caseCube": 105.46600000000001
  }
}
```

Then you need to fix 5 fields there: _caseWidth, caseHeight, caseLen, caseCube_ and _price_.

According to our data model all these fields have scale=3 (so, max 3 digits after fp) and field _price_ - scale=2.

Then, our code could be like this:

```
  const fpFxCtx: FpFixerContext = {
    config: [ 
      { scale:2, names:['price'] }, 
      { scale:3, names:['caseWidth', 'caseHeight', 'caseLen', 'caseCube'] }
    ]
  }

  // [...]

  // then, after we received our data from server API we need to call:

  callSrvApi() 
    .then((res: any) => {
      if (res.data) {
        fixFpFields(rec.data, fpFxCtx) // <-- fix all fp-numbers in object just after received it
        // do all the rest 
      }
    })


```

Just after such call data structure will be like this:

```
{
  "data": {
    "partNo": "DM8780-DRY-P0  ", 
    "uom": "100g",     
    "price": 9.97, 
    "caseWidth": 4.725, 
    "caseHeight": 4.728, 
    "caseLen": 4.721,
    "caseCube": 105.466
  }
}
```

Thus, what we have:
* we removed extra digits from fp-fraction part for all numbers
* we still have data type = number


## Example 2. A bit more complex structure

You receiving from server response like this:

```
{
  "data": {
    "partNo": "DM8780-DRY-P0  ", 
    "uom": "100g",     
    "price": 9.9700002, 
    "caseWidth": 4.7250000000000005, 
    "caseHeight": 4.728000000000001, 
    "caseLen": 4.7210002,
    "caseCube": 105.46600000000001
    "bom": [
      {"partNo": "XD17DRGZ-A", "qty": 17.1000003 },
      {"partNo": "ZRW3-C", "qty": 33.7700004 }
    ],
    "cost": { 
      "shpPoint": 0,
      "prdCost": 1.8975000000000002,
      "discount": 0.100000001,
      "currCode": "USD"
    }
  }
}
```

Here we need to fix fp-numbers not only on 1st level of response object but also in sub-objects.

Then, our code could be like this:

```
  const fpFxAbstract: FpFixerContext = {
    config: [ 
      { scale:2, names:['price'] } ,
      { scale:3, names:['caseWidth', 'caseHeight', 'caseLen', 'caseCube'] } ,
      { entityRef: "bom", names:['bom'] }, 
      { entityRef: "cost", names:['cost'] } 
    ],
    entities: {
      "bom": [ 
        { scale:2, names:['qty'] } 
      ],
      "cost": [ 
        { scale:2, names:['prdCost', 'discount'] } 
      ],
    }
  }

  // [...]

  // then, after we received our data from server API we need to call:

  callSrvApi() 
    .then((res: any) => {
      if (res.data) {
        fixFpFields(rec.data, fpFxCtx) // <-- fix all fp-numbers in object just after received it
        // do all the rest 
      }
    })

```

__Note__: _entityRef_ field defines a ref to fp-fixer config for other entity and when there nothing in field _names_ then it will apply fp-fixer config for that entity on current object level. With such approach you can maintain something like cascading fp-fixer definitions.


# Usage

You can use maintain it in 2 ways:
* have one set of entities descriptors for whole application project
* or you can define small sub-sets of entities descriptors inside API consumer source file.

Just choose which is more suitable for your situation.

Example:

```
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
```

# See Also

* IEEE-754 convertor: https://www.h-schmidt.net/FloatConverter/IEEE754.html 