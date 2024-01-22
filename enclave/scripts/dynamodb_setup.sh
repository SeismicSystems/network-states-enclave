touch ~/.aws/credentials
echo "[default]" > ~/.aws/credentials
echo "aws_access_key_id = $1" >> ~/.aws/credentials
echo "aws_secret_access_key = $2" >> ~/.aws/credentials

aws dynamodb create-table \
    --table-name tiles \
    --attribute-definitions \
        AttributeName=tileHash,AttributeType=S \
    --key-schema \
        AttributeName=tileHash,KeyType=HASH \
    --table-class STANDARD\
    --provisioned-throughput \
        ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --endpoint-url http://localhost:8000