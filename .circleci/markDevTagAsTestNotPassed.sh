# get git branch name-----------
branch_name="$(git symbolic-ref HEAD 2>/dev/null)" ||
branch_name="(unnamed branch)"     # detached HEAD

branch_name=${branch_name##refs/heads/}

if [[ $branch_name =~ ^test-cicd/.*$ ]]
then
    echo "This is a ci testing branch ($branch_name), exiting early"
    exit 0
fi

frontendDriverJson=`cat ../frontendDriverInterfaceSupported.json`
frontendDriverLength=`echo $frontendDriverJson | jq ".versions | length"`
frontendDriverArray=`echo $frontendDriverJson | jq ".versions"`
echo "got frontend driver relations"

# get sdk version
version=`cat ../package.json | grep -e '"version":'`
while IFS='"' read -ra ADDR; do
    counter=0
    for i in "${ADDR[@]}"; do
        if [ $counter == 3 ]
        then
            version=$i
        fi
        counter=$(($counter+1))
    done
done <<< "$version"

responseStatus=`curl -s -o /dev/null -w "%{http_code}" -X PUT \
  https://api.supertokens.io/0/frontend \
  -H 'Content-Type: application/json' \
  -H 'api-version: 0' \
  -d "{
	\"password\": \"$SUPERTOKENS_API_KEY\",
	\"version\":\"$version\",
    \"name\": \"react-native\",
	\"frontendDriverInterfaces\": $frontendDriverArray
}"`
if [ $responseStatus -ne "200" ]
then
    echo "failed core PUT API status code: $responseStatus. Exiting!"
	exit 1
fi