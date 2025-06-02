# meta-land-contract
Next version of Comunion contract project

# how to contribute code 

1. develop is the development branch, not allowed push directly.

2. release is the pre production branch，only merged by develop, just for the test.

3. main is the production branch, only merged by release branch, 

4. feat/xxx or feature/xxx is the function branch, 

5. fix/xxx for fix bug

6. hotfix/xxx for ambulance bug

# how to start
1. install dependences
    ```
    pnpm install
    ```

2. add a sol in contract dir
 
3. how to test your contract
  -. write your test sol in test dir
  -. the test function name must start with "test"
  -. migrate your contract
  -. run
    ```
    npx hardhat test
    ```
    ```
    npx hardhat coverage
    ```

# how to created local environment

1. use npm install remixed tools

    ```
    npm install -g @remix-project/remixd
    ```

2. open remixed page ( http://remix.ethereum.org)

3. start
in your source code, run
    ```
    remixed -s [your source code list] --remix-ide http://remix.ethereum.org
    ```

4. open "https://remix.ethereum.org/#optimize=true&runs=200"
5. click home -> file -> connect to local host;
6. after loading, happy coding
7. if you installed ganache, you can use ganache;
  - npm install -g ganache-cli
  - use ganache, run ganache-cli in your terminal
    ```
      ganache-cli
    ```
  - if you installed ganache by GUI， you can start it directly
8. after deployed contract, please update contract address in contractAddress.json file
