// db.js
const { MongoClient, ObjectId } = require('mongodb');
const url = 'mongodb+srv://Admin:FOODIE@clusterfoodie.10j4aom.mongodb.net/';
const client = new MongoClient(url);

let database;

async function connect() {
    if (!database) {
        await client.connect();
        console.log("Conectado a la base de datos");
        database = client.db('foodie');
    }
    return database;
}

function objectID(id) {
    return new ObjectId(id);
}

async function query(type, collection, mainObject, secondObject, thirdObject) {
    const db = await connect();
    let res;
    switch (type) {
        case "insert":
            console.log("Insert:");
            res = await db.collection(collection).insertOne(mainObject);
            console.log(res);
            return res;

        case "deleteOne":
            console.log("Delete One:");
            res = await db.collection(collection).deleteOne(mainObject);
            console.log(res);
            return res;

        case "update":
            console.log("Update:");
            res = await db.collection(collection).updateOne(mainObject, secondObject, thirdObject);
            console.log(res);
            return res;

        case "find":
            console.log("Find:");
            res = await db.collection(collection).find(mainObject).project(secondObject).toArray();
            console.log(res);
            return res;

        case "aggregation":
            console.log("Aggregate:");
            res = await db.collection(collection).aggregate(mainObject).toArray();
            console.log(res);
            return res;

        default:
            break;
    }
}

module.exports = { query, objectID };
