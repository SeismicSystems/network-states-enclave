touch ~/.aws/credentials
echo "[default]" > ~/.aws/credentials
echo "aws_access_key_id = $1" >> ~/.aws/credentials
echo "aws_secret_access_key = $2" >> ~/.aws/credentials

aws dynamodb create-table \
    --table-name claimedTiles \
    --attribute-definitions \
        AttributeName=hash,AttributeType=S \
    --key-schema \
        AttributeName=hash,KeyType=HASH \
    --table-class STANDARD\
    --provisioned-throughput \
        ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --endpoint-url http://localhost:8000

aws dynamodb create-table \
    --table-name enclaveValues \
    --attribute-definitions \
        AttributeName=name,AttributeType=S \
    --key-schema \
        AttributeName=name,KeyType=HASH \
    --table-class STANDARD\
    --provisioned-throughput \
        ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --endpoint-url http://localhost:8000
