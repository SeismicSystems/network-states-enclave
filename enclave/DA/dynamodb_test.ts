const item = { id:"124",test: 1542,lis: ["dfd",12],bigint: BigInt(1000000000000000000000.000000000001),settest: new Set([123, 456, 789])};
const tableName = 'MyTable'; // id is my hash key

import { addorReplaceDataToDynamoDB, deleteDataFromDynamoDB, getDataFromDynamoDB, updateDataToDynamoDB } from "./dynamodb_setup";


const putItem=await addorReplaceDataToDynamoDB(tableName,item)
console.log(putItem)

const getItem=await getDataFromDynamoDB(tableName,{"id":"124"})
console.log(getItem)

const updateitem = await updateDataToDynamoDB(tableName,{"id":"124"},"set test = :c, abc =:abc",{":c":"change",":abc":"new_value"})
console.log(updateitem)

const getItem2=await getDataFromDynamoDB(tableName,{"id":"124"})
console.log(getItem2)

const deleteItem=await deleteDataFromDynamoDB(tableName,{"id":"124"})

const getItem3=await getDataFromDynamoDB(tableName,{"id":"124"})
console.log(getItem3)