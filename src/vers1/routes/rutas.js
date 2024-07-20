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

router.post('/addComedor', verifyToken, async (req, res) => {
    const { id, userType } = req.user;
    const { comedorCode } = req.body;

    if (userType === 'cliente') {
        const comedor = await db.query("find", "proveedores", { clave: comedorCode }, { _id: 1 });
        if (comedor.length > 0) {
            const result = await db.query("update", "clientes", { _id: db.objectID(id) }, { $addToSet: { proveedores: { id_proveedor: comedor[0]._id } } });
            return res.json({ message: 'Comedor added successfully', result });
        } else {
            return res.status(404).json({ message: 'Comedor not found' });
        }
    } else {
        res.sendStatus(403);
    }
});

router.post('/deleteComedor', verifyToken, async (req, res) => {
    const { id, userType } = req.user;
    const { comedorId } = req.body;

    if (userType === 'cliente') {
        const result = await db.query("update", "clientes", { _id: db.objectID(id) }, { $pull: { proveedores: { id_proveedor: db.objectID(comedorId) } } });
        return res.json({ message: 'Comedor deleted successfully', result });
    } else {
        res.sendStatus(403);
    }
});

router.get('/comedor/:id', verifyToken, async (req, res) => {
    const comedorId = req.params.id;
    const comedor = await db.query("find", "proveedores", { _id: db.objectID(comedorId) }, { _id: 1, nombre: 1, calif: 1, imagen: 1 });
    if (comedor.length > 0) {
      res.json(comedor[0]);
    } else {
      res.sendStatus(404);
    }
  });
  
  router.get('/comedor/:id/comida', verifyToken, async (req, res) => {
    const comedorId = req.params.id;
    const comida = await db.query("find", "productos", { id_proveedor: db.objectID(comedorId), categoria: 'comida' }, {imagen:1,nombre:1,descripcion:1,precio:1,_id:1});
    res.json(comida);
  });
  
  router.get('/comedor/:id/bebidas', verifyToken, async (req, res) => {
    const comedorId = req.params.id;
    const bebidas = await db.query("find", "productos", { id_proveedor: db.objectID(comedorId), categoria: 'bebidas' }, {imagen:1,nombre:1,descripcion:1,precio:1,_id:1});
    res.json(bebidas);
  });
  
  router.get('/comedor/:id/frituras', verifyToken, async (req, res) => {
    const comedorId = req.params.id;
    const frituras = await db.query("find", "productos", { id_proveedor: db.objectID(comedorId), categoria: 'frituras' }, {imagen:1,nombre:1,descripcion:1,precio:1,_id:1});
    res.json(frituras);
  });
  
  router.get('/comedor/:id/dulces', verifyToken, async (req, res) => {
    const comedorId = req.params.id;
    const dulces = await db.query("find", "productos", { id_proveedor: db.objectID(comedorId), categoria: 'dulces' }, {imagen:1,nombre:1,descripcion:1,precio:1,_id:1});
    res.json(dulces);
  });
  
  router.get('/comedor/:id/otros', verifyToken, async (req, res) => {
    const comedorId = req.params.id;
    const otros = await db.query("find", "productos", { id_proveedor: db.objectID(comedorId), categoria: 'otros' }, {imagen:1,nombre:1,descripcion:1,precio:1,_id:1});
    res.json(otros);
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

            if(userType === 'Usuario'){
                const nuevoCarrito = await db.query("insert","pedidos",{cliente: correo ,estado:"Carrito",proveedor:"",especificaciones:"",descripcion:[],especificaciones:""})
            console.log(nuevoCarrito)
            }
            
            return res.status(201).json({ message: 'Usuario registrado con éxito', userId: result.insertedId });
        }
    } else {
        return res.status(400).json({ message: 'La contraseña no fue confirmada correctamente' });
    }
});

// Ruta para obtener los datos del usuario autenticado
router.post('/edit/:campo', verifyToken, async (req, res) => {
    const { id, userType } = req.user;
    const {campo} = req.params //el campo que se va a editar
    const {newValue} = req.body //el valor que se le va a dar
    let data = {} //objeto que se utiliza para hacer el update

    if(campo=="min_espera"){
        data[campo] = +newValue //guarda el valor numerico, no el string del numero
    }else if(campo == "active"){
        data[campo] = newValue=="true"?true:false //guarda un valor booleano
    }else{
        data[campo] = newValue //guarda el valor como string
    }
    

    if (userType === 'cliente') {
        // Actualiza la información del cliente
        const cliente = await db.query("update", "clientes", { _id: db.objectID(id) },{$set:data});
        if (cliente.acknowledged > 0) {
            return res.status(201).json({ message: `Campo ${campo} actualizado con éxito, nuevo valor: ${newValue}`});
        }else{
            res.sendStatus(404);
        }
    }

    if (userType === 'proveedor') {
        // Actualiza la info del proveedor
        const proveedor = await db.query("find", "proveedores", { _id: db.objectID(id) }, {$set:data});
        if (proveedor.acknowledged > 0) {
            return res.status(201).json({ message: `Campo ${campo} actualizado con éxito, nuevo valor: ${newValue}`});
        }else{
            res.sendStatus(404);
        }
    }

    res.sendStatus(403);
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