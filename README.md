# Orders microservice
This microservice handles order management for the ProductsApp application. It is built using NestJS and connects to a PostgreSQL database.
## Installation
1. Clone the repository:
    ```
    git clone
    ```
2. Navigate to the project directory:
    ```
    cd orders-ms
    ```
3. Install dependencies:
    ```
    npm install
    ```
4. Ejecute the script docker-compose.yml to create a postgres container:
    ```
    docker-compose up -d
    ```
## Configuration
Create a `.env` file in the root directory and add the following environment variables:
  ```
  PORT=3000
  ```
## Running the application
To start the application, run:
```
npm run start:dev
```
The application will be accessible at `http://localhost:3000`.
