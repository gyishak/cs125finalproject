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
    2. File in ./secrets/ directory (e.g., secrets/mysql_password.txt)
    3. Default value
    """
    # 1. Try environment variable
    secret_value = os.getenv(secret_name.upper())
    if secret_value:
        # print(f"Loaded secret '{secret_name}' from environment variable.")
        return secret_value

    # 2. Try file (relative to this file)
    file_path = os.path.join(os.path.dirname(__file__), "secrets", f"{secret_name.lower()}.txt")
    try:
        with open(file_path, "r") as f:
            secret_value = f.read().strip()
            # print(f"Loaded secret '{secret_name}' from file.")
            return secret_value
    except FileNotFoundError:
        pass  # proceed to default

    # 3. Use default
    if default is not None:
        warnings.warn(
            f"Secret '{secret_name}' not found in environment or file. Using a default value. "
            f"This is not recommended for production.",
            UserWarning,
        )
        return default

    raise ValueError(
        f"Secret '{secret_name}' not found in environment or file, and no default was provided."
    )


# --- MySQL Configuration ---
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = load_secret("mysql_password")
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = 3399
DB_NAME = os.getenv("DB_NAME", "youth_db")

# --- MongoDB Configuration ---
# (We now load this from secrets/mongo_uri.txt instead of hardcoding)
MONGO_URI = load_secret("mongo_uri")
MONGO_DB_NAME = "youth_ministry"

# --- Redis Configuration ---
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
                database=DB_NAME,
            )
            print("Database connection pool created successfully.")
        except mysql.connector.Error as err:
            print(f"Error creating connection pool: {err}")

    return db_pool


def get_db_connection():
    """Gets a connection from the MySQL pool."""
    pool = get_mysql_pool()
    return pool.get_connection()


# 👇 NEW: alias so graphql_api can call get_mysql_conn()
def get_mysql_conn():
    """
    Backwards-compatible alias for code that expects get_mysql_conn().
    """
    return get_db_connection()


def get_mongo_client():
    """Initializes and returns the MongoDB client."""
    global mongo_client
    if mongo_client is None:
        try:
            mongo_client = MongoClient(MONGO_URI, server_api=ServerApi("1"))
            # Send a ping to confirm a successful connection
            mongo_client.admin.command("ping")
            print("Pinged your deployment. You successfully connected to MongoDB!")
        except Exception as e:
            print(f"Error connecting to MongoDB: {e}")

    return mongo_client


def get_mongo_db():
    """Gets the MongoDB database instance."""
    client = get_mongo_client()
    return client[MONGO_DB_NAME]


# 👇 NEW: simple helper to get a specific collection
def get_mongo_collection(name: str):
    db = get_mongo_db()
    return db[name]


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
                password=REDIS_PASSWORD,
            )
            # Check connection
            redis_client.ping()
            print("Successfully connected to Redis!")
        except Exception as e:
            print(f"Error connecting to Redis: {e}")

    return redis_client


def get_redis_conn():
    """Gets the Redis client instance (alias used in app.py)."""
    return get_redis_client()


# --- Graceful Shutdown ---
def close_connections():
    """Close all database connections."""
    global mongo_client
    if mongo_client:
        mongo_client.close()
        mongo_client = None
        print("MongoDB connection closed.")

    # Redis client usually doesn't need explicit close
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


