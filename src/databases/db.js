// db.js es la configuración de la base de datos
const { MongoClient, ObjectId} = require('mongodb')
const local = false
const url = local?'mongodb://127.0.0.1:27017':'mongodb+srv://Admin:FOODIE@clusterfoodie.10j4aom.mongodb.net/'
const client = new MongoClient(url)

const dbName = local?'foodieLocal':'foodie'

async function con(){
    console.log("inicia la funcion")
    await client.connect()
    console.log("conectado chido")
    const database = client.db(dbName)
    const cli = await database.collection('clientes').find().toArray()
    console.log(cli[0]._id)
}

function objectID(id){
    let ID = new ObjectId(id)
    return ID
}

async function query(type,collection,mainObject,secondObject,thirdObject) {
    await client.connect()
    console.log("conexion lograda")
    const database = client.db(dbName)
    let res
    switch (type) {
        case "insert":
            console.log("Insert:")
            res = await database.collection(collection).insertOne(mainObject)
            await client.close()
            console.log(res)
            return res

        case "deleteOne":
            console.log("Delete One:")
            res = await database.collection(collection).deleteOne(mainObject)
            await client.close()
            console.log(res)
            return res
            
        case "deleteMany":
            console.log("Delete Many:")
            res = await database.collection(collection).deleteMany(mainObject)
            await client.close()
            console.log(res)
            return res

        case "update":
            console.log("Update:")
            res = await database.collection(collection).updateOne(mainObject,secondObject,thirdObject)
            await client.close()
            console.log(res)
            return res

        case "find":
            console.log("Find:")
            res = await database.collection(collection).find(mainObject).project(secondObject).toArray()
            await client.close()
            console.log(res)
            return res
        case "aggregation":
            console.log("Aggregate:")
            res = await database.collection(collection).aggregate(mainObject).toArray()
            await client.close()
            console.log(res)
            return res

        default:
            await client.close()
            return "Query no valido"
    }
}

con()
.catch(console.error)
.finally(()=>client.close())

module.exports = {query,objectID};