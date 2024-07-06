const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require("../../databases/db");

// Clave secreta para firmar el token. 
const SECRET_KEY = 'foodie';

const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function crearClave() {
    let clave = "";
    for (let i = 0; i < 6; i++) {
        const indiceAleatorio = Math.floor(Math.random() * caracteres.length);
        clave += caracteres.charAt(indiceAleatorio);
    }
    return clave;
}

// Ruta de inicio de sesión
router.post('/auth/login', async (req, res) => {
    const { email, password, expiresInMins } = req.body;

    const expiresIn = expiresInMins ? `${expiresInMins}m` : '1h'; //Checa si hay un valor valido en expiresInMins si si usa ese valor si no pone un default de 1h

    // Busca el usuario en la colección de clientes
    const cliente = await db.query("find", "clientes", { correo: email, "contraseña": password }, { _id: 1 });
    if (cliente.length > 0) {
        const token = jwt.sign({ id: cliente[0]._id, userType: "cliente" }, SECRET_KEY, { expiresIn });
        return res.json({ token });
    }else{
    // Busca el usuario en la colección de proveedores
    const proveedor = await db.query("find", "proveedores", { correo: email, "contraseña": password }, { _id: 1 });
    if (proveedor.length > 0) {
        const token = jwt.sign({ id: proveedor[0]._id, userType: "proveedor" }, SECRET_KEY, { expiresIn });
        return res.json({ token });
    }}

    // Si no se encuentra el usuario
    res.status(401).json({ message: "Invalid email or password" });
});

// Middleware para verificar el token
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Ruta para obtener los datos del usuario autenticado
router.get('/auth/me', verifyToken, async (req, res) => {
    const { id, userType } = req.user;

    if (userType === 'cliente') {
        // Busca la información del cliente
        const cliente = await db.query("find", "clientes", { _id: db.objectID(id) }, { _id: 1, nombre: 1, apellido: 1, correo: 1, telefono: 1, created_at: 1 , imagen: 1 ,  active: 1 });
        if (cliente.length > 0) {
            return res.json(cliente[0]);
        }
    }

    if (userType === 'proveedor') {
        // Devuelve la info del proveedor
        const proveedor = await db.query("find", "proveedores", { _id: db.objectID(id) }, { _id: 1, nombre: 1, correo: 1, telefono: 1, imagen: 1, direccion: 1, calif: 1, min_espera: 1, clave: 1 });
        if (proveedor.length > 0) {
            return res.json(proveedor[0]);
        }
    }

    res.sendStatus(404);
});

// Ruta para obtener los comedores de un cliente
router.get('/comedores', verifyToken, async (req, res) => {
    const { id, userType } = req.user;

    if (userType === 'cliente') {
        const cliente = await db.query("find", "clientes", { _id: db.objectID(id) }, { "proveedores.id_proveedor": 1, _id: 0 });
        let idsComedores = [];
        if (cliente[0].proveedores.length > 0) {
            cliente[0].proveedores.forEach(comedor => {
                idsComedores.push(comedor.id_proveedor);
            });
            const info = await db.query("find", "proveedores", { _id: { $in: idsComedores } }, { _id: 1, nombre: 1, calif: 1, min_espera: 1, imagen: 1 });
            return res.json(info);
        } else {
            return res.json([]);
        }
    } else {
        res.sendStatus(403);
    }
});


router.post('/auth/register', async (req, res) => {
    const { nombre, apellido, telefono, correo, contraseña, confirm_password, userType, nombre_empresa, rfc, direccion_comercial, regimen_fiscal, correo_corporativo } = req.body;
    if (contraseña === confirm_password) {
        const collection = userType === 'Usuario' ? "clientes" : "proveedores";
        const queryCondition = userType === 'Usuario'
            ? { $or: [{ telefono: telefono }, { correo: correo }] }
            : { $or: [{ telefono: telefono }, { correo: correo }, { rfc: rfc }] };

        const usuarios = await db.query("find", collection, queryCondition, {});
        if (usuarios.length > 0) {
            if (userType === 'Usuario') {
                return res.status(400).json({ message: 'Correo o teléfono ya registrado en otra cuenta' });
            }else{
                return res.status(400).json({ message: 'Correo, teléfono o RFC ya registrado en otra cuenta' });
            }
            
        } else {
            let clave = "";
            const clavesExistentes = await db.query("find", "proveedores", {}, { clave: 1, _id: 0 });
                let claves = clavesExistentes.map(item => item.clave);
                
                clave = crearClave();
                while (claves.includes(clave)) {
                    clave = crearClave();
                }

            const queryObject = userType === 'Usuario' ? {
                nombre: nombre + " " + apellido,
                //apellido: apellido,
                correo: correo,
                contraseña: contraseña,
                telefono: telefono,
                created_at: new Date(),
                imagen: 'rutaImaginaria.jpg',
                active: true,
                proveedores: []
            } : {
                nombre: nombre_empresa,
                correo: correo_corporativo,
                contraseña: contraseña,
                telefono: telefono,
                created_at: new Date(),
                imagen: 'rutaImaginaria.jpg',
                active: true,
                regimen_fiscal: regimen_fiscal,
                direccion: direccion_comercial,
                calif: 0,
                rfc: rfc,
                min_espera: 15,
                clave: clave
            };

            const result = await db.query("insert", collection, queryObject, {});
            return res.status(201).json({ message: 'Usuario registrado con éxito', userId: result.insertedId });
        }
    } else {
        return res.status(400).json({ message: 'La contraseña no fue confirmada correctamente' });
    }
});

module.exports = router;


// router.get('/login/:email/:password', async (req, res) => {
//     const { email, password } = req.params;

//     const cliente = await db.query("find","clientes",{correo:email,"contraseña":password},{_id:1})
//     console.log(cliente)
//     if(cliente.length>0){
//         res.json({id:cliente[0]._id,email:email,userType: "cliente",logged:true})
//     }else{
//         const proveedor = await db.query("find","proveedores",{correo:email,password:password},{_id:1})
//         if(proveedor.length>0){
//             res.json({id:proveedor[0]._id,email:email,userType: "proveedor",logged:true})
//         }else{
//             res.json({logged:false})
//         }
//     }

// });

//  router.get('/comedores/:id',async (req,res)=>{
//      console.log('inicia el query para mostrar los comedores')
//      const id = req.params.id
//      const respuesta = await db.query("find","clientes",{_id:db.objectID(id)},{"proveedores.id_proveedor":1,_id:0})
//      let idsComedores = []
//      if(respuesta[0].proveedores.length>0){
//          respuesta[0].proveedores.forEach(comedor => {
//              idsComedores.push(comedor.id_proveedor)
//          })
//          console.log("mostrando correos:")
//          console.log(idsComedores)
//          console.log("Buscando comedores:")
//          const info = await db.query("find","proveedores",{_id:{$in:idsComedores}},{_id:1,nombre:1,calif:1,min_espera:1,imagen:1,active:1})
        
        
//         res.json(info)
//      }else{
//          res.json({})
//      }
//  })

//     module.exports = router