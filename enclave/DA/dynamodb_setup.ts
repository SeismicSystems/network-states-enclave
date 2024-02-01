import {
    DynamoDBClient,
    ScanCommandInput,
    ScanCommandOutput,
} from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    PutCommand,
    GetCommand,
    UpdateCommand,
    DeleteCommand,
    ScanCommand,
    BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });
const ddbClient = new DynamoDBClient({
    region: "us-east-1",
    endpoint: process.env.DYNAMODB_ENDPOINT,
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

export const scanFullTable = async (tableName: string) => {
    const params: ScanCommandInput = {
        TableName: tableName,
    };

    const scanResults: any = [];
    let items: ScanCommandOutput;
    do {
        items = await ddbDocClient.send(new ScanCommand(params));
        items.Items?.forEach((item) => scanResults.push(item));
        params.ExclusiveStartKey = items.LastEvaluatedKey;
    } while (typeof items.LastEvaluatedKey !== "undefined");

    return scanResults;
};

// pass tablename , keyname like "id" and list of keys you want to get like ["hash1",hash2,"hash3"..]
export const getBatchItems = async (
    tableName: string,
    keyname: string,
    keys: [string]
) => {
    let finalkey = [keys.map((value, index) => ({ [keyname]: value }))];
    let result: Record<string, any>[] = [];
    for (let i = 0; i < finalkey.length; i += 100) {
        const block = await ddbDocClient.send(
            new BatchGetCommand({
                RequestItems: {
                    [tableName]: {
                        Keys: finalkey.slice(
                            i,
                            Math.min(i + 100, finalkey.length)
                        ),
                    },
                },
            })
        );
        result.push.apply(block.Responses?.[tableName]);
    }

    return result;
};
