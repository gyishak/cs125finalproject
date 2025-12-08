import mysql.connector.pooling
from pymongo import MongoClient
from pymongo.server_api import ServerApi
import redis
import os
import warnings

# --- Secret Management ---
def load_secret(secret_name: str, default: str = None) -> str:
    """
    Loads a secret from an environment variable or a file.
    Priority:
    1. Environment variable (e.g., MYSQL_PASSWORD)
    2. File in ../secrets/ directory (e.g., ../secrets/mysql_password.txt)
    3. Default value
    """
    # 1. Try environment variable
    secret_value = os.getenv(secret_name.upper())
    if secret_value:
        # print(f"Loaded secret '{secret_name}' from environment variable.")
        return secret_value

    # 2. Try file
    # Note: This path is relative to this file's location (python/)
    file_path = os.path.join(os.path.dirname(__file__), 'secrets', f'{secret_name.lower()}.txt')
    try:
        with open(file_path, 'r') as f:
            secret_value = f.read().strip()
            # print(f"Loaded secret '{secret_name}' from file.")
            return secret_value
    except FileNotFoundError:
        pass # File not found, will proceed to default

    # 3. Use default
    if default:
        warnings.warn(f"Secret '{secret_name}' not found in environment or file. Using a default value. This is not recommended for production.", UserWarning)
        return default

    raise ValueError(f"Secret '{secret_name}' not found in environment or file, and no default was provided.")


# --- MySQL Configuration ---
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = load_secret("mysql_password")
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT=3399
DB_NAME = os.getenv("DB_NAME", "youth_db")

# --- MongoDB Configuration ---
MONGO_URI = "mongodb+srv://gyishak_db_user:QRexsPegScsmDJZq@cluster0.tsmk7o0.mongodb.net/?appName=Cluster0"
MONGO_DB_NAME = "youth_ministry"

# --- Redis Configuration ---
# For Redis, the URL format is often easier to manage than host, port, etc. separately
REDIS_PASSWORD = load_secret("redis_password")
REDIS_HOST = load_secret("redis_host")
REDIS_PORT = 11093
REDIS_USERNAME = "default"



# --- Connection Clients / Pools ---
db_pool = None
mongo_client = None
redis_client = None

def get_mysql_pool():
    """Initializes and returns the MySQL connection pool."""
    global db_pool
    if db_pool is None:
        try:
            db_pool = mysql.connector.pooling.MySQLConnectionPool(
                pool_name="fastapi_pool",
                pool_size=5,
                user=DB_USER,
                password=DB_PASSWORD,
                host=DB_HOST,
                port=DB_PORT,
                database=DB_NAME
            )
            print("Database connection pool created successfully.")
        except mysql.connector.Error as err:
            print(f"Error creating connection pool: {err}")
            
    return db_pool

def get_mongo_client():
    """Initializes and returns the MongoDB client."""
    global mongo_client
    if mongo_client is None:
        try:
            mongo_client = MongoClient(MONGO_URI, server_api=ServerApi('1'))
            # Send a ping to confirm a successful connection
            mongo_client.admin.command('ping')
            print("Pinged your deployment. You successfully connected to MongoDB!")
        except Exception as e:
            print(f"Error connecting to MongoDB: {e}")
            
    return mongo_client

def get_redis_client():
    """Initializes and returns the Redis client."""
    global redis_client
    if redis_client is None:
        try:
            redis_client = redis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                decode_responses=True,
                username=REDIS_USERNAME,
                password=REDIS_PASSWORD
            )
            # Check connection
            redis_client.ping()
            print("Successfully connected to Redis!")
        except Exception as e:
            print(f"Error connecting to Redis: {e}")
           
    return redis_client

# --- Functions to be called from the FastAPI app ---
def get_db_connection():
    """Gets a connection from the MySQL pool."""
    pool = get_mysql_pool()
    return pool.get_connection()

def get_mongo_db():
    """Gets the MongoDB database instance."""
    client = get_mongo_client()
    return client[MONGO_DB_NAME]

def get_redis_conn():
    """Gets the Redis client instance."""
    return get_redis_client()

# --- Graceful Shutdown ---
def close_connections():
    """Close all database connections."""
    # MySQL pool doesn't have an explicit close, connections are returned to pool.
    # MongoDB client should be closed if the app is shutting down.
    global mongo_client
    if mongo_client:
        mongo_client.close()
        print("MongoDB connection closed.")
    # Redis client doesn't require explicit closing for this library version
    # when used like this, but it's good practice if a close method is available.
    print("Connection cleanup finished.")

# Example of how to use the functions
if __name__ == "__main__":
    print("Attempting to connect to all databases...")
    get_mysql_pool()
    get_mongo_client()
    get_redis_client()
    print("\nAll database connections seem to be configured correctly.")
    print("This script is for setting up connections. Run the main FastAPI app to start the server.")
    close_connections()
