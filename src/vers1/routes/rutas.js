const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require("../../databases/db");

// Clave secreta para firmar el token. 
const SECRET_KEY = 'foodie';

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
        // Busca los comedores relacionados con el cliente
        const respuesta = await db.query("find", "clientes", { _id: db.objectID(id) }, { "proveedores.id_proveedor": 1, _id: 0 });
        let idsComedores = [];
        if (respuesta[0].proveedores.length > 0) {
            respuesta[0].proveedores.forEach(comedor => {
                idsComedores.push(comedor.id_proveedor);
            });
            const info = await db.query("find", "proveedores", { _id: { $in: idsComedores } }, { _id: 1, nombre: 1, calif: 1, min_espera: 1, active: 1 });
            return res.json(info);
        } else {
            return res.json([]);
        }
    }

    if (userType === 'proveedor') {
        // Devuelve el teléfono y dirección del proveedor
        const proveedor = await db.query("find", "proveedores", { _id: db.objectID(id) }, { _id: 1, correo: 1, telefono: 1, direccion: 1 });
        if (proveedor.length > 0) {
            return res.json(proveedor[0]);
        }
    }

    res.sendStatus(404);
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