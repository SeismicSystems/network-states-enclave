import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    UpdateCommand,
    DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
const ddbClient = new DynamoDBClient({
    region: "us-east-1",
    endpoint: "http://127.0.0.1:8000", // make it env variable for local:-http://127.0.0.1:8000 , docker:- http://dynamodb:8000 for production remove this endpoint
});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient, {});

export const getDataFromDynamoDB = async (tableName: string, key: any) => {
    const data = await ddbDocClient.send(
        new GetCommand({
            TableName: tableName,
            Key: key,
        })
    );
    return data.Item;
};

export const addorReplaceDataToDynamoDB = async (
    tableName: string,
    item: any
) => {
    const res = await ddbDocClient.send(
        new PutCommand({
            TableName: tableName,
            Item: item,
        })
    );
    return res;
};

export const deleteDataFromDynamoDB = async (tableName: string, key: any) => {
    const res = await ddbDocClient.send(
        new DeleteCommand({
            TableName: tableName,
            Key: key,
        })
    );
    return res;
};

export const isExistRecord = async (tableName: string, key: any) => {
    const res = await ddbDocClient.send(
        new GetCommand({
            TableName: tableName,
            Key: key,
        })
    );
    return res.Item != undefined ? true : false;
};

export const updateDataToDynamoDB = async (
    tableName: string,
    key: any,
    updateExpression: any,
    expressionAttributeValues: any
) => {
    const res = await ddbDocClient.send(
        new UpdateCommand({
            TableName: tableName,
            Key: key,
            UpdateExpression: updateExpression,
            ExpressionAttributeValues: expressionAttributeValues,
        })
    );
    return res;
};
