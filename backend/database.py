from motor.motor_asyncio import AsyncIOMotorClient
import os

_client = None
_db = None


def get_db():
    return _db


async def init_db():
    global _client, _db
    _client = AsyncIOMotorClient(
        os.environ["MONGO_URL"],
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=5000,
        socketTimeoutMS=10000,
        maxPoolSize=20,
        minPoolSize=2,
        waitQueueTimeoutMS=5000,
    )
    _db = _client[os.environ["DB_NAME"]]
    return _db


def close_db():
    if _client:
        _client.close()
