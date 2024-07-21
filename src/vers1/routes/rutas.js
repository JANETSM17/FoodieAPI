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
        return res.json({ token, userType: "cliente"  });
    }else{
    // Busca el usuario en la colección de proveedores
    const proveedor = await db.query("find", "proveedores", { correo: email, "contraseña": password }, { _id: 1 });
    if (proveedor.length > 0) {
        const token = jwt.sign({ id: proveedor[0]._id, userType: "proveedor" }, SECRET_KEY, { expiresIn });
        return res.json({ token, userType: "proveedor"  });
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
        const cliente = await db.query("find", "clientes", { _id: db.objectID(id) }, { _id: 1, nombre: 1, correo: 1, telefono: 1, created_at: 1 , imagen: 1 ,  active: 1 });
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
                imagen: '../assets/images/fotosCliente/FoxClient.jpeg',
                active: true,
                proveedores: []
            } : {
                nombre: nombre_empresa,
                correo: correo_corporativo,
                contraseña: contraseña,
                telefono: telefono,
                created_at: new Date(),
                imagen: '../assets/images/fotosProveedor/cubiertos.png',
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

router.get('/getCarrito/:correo', verifyToken , async (req,res) => {
    const correo = req.params.correo
    try {
        const info = await db.query("find","pedidos",{cliente: correo , estado:"Carrito"},{_id:1});
        if (info.length > 0) {
            console.log("Se obtuvo el id del carrito: " + info[0]._id);
            res.json(info[0]._id);
        } else {
            res.status(404).json({ message: "No carrito found" });
        }
    } catch (error) {
        console.error("Error fetching carrito ID:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
  });

  router.get('/confirmarCarrito/:id_producto/:idCarrito', verifyToken, async (req, res) => {
    const { id_producto, idCarrito } = req.params;
    try {
        
        const productExists = await db.query("find","pedidos",{_id:db.objectID(idCarrito),"descripcion.producto.id_producto":db.objectID(id_producto)},{_id:1})
        if (productExists.length > 0) {
            res.json({ exists: true });
        } else {
            res.json({ exists: false });
        }
    } catch (error) {
        console.error("Error confirming cart:", error);
        res.status(500).json({ message: "Internal server error" });
    }
  });

  router.get('/agregarCarrito/:id_producto/:idCarrito', verifyToken, async (req, res) => {
    const id_producto = req.params.id_producto;
    const id_carrito = req.params.idCarrito;
  
    try {
      console.log('Inicia el query');
  
      // Obtener información del producto
      const producto = await db.query("find", "productos", {_id: db.objectID(id_producto)}, {_id: 1, nombre: 1, precio: 1, id_proveedor: 1});
      
      // Obtener información del proveedor del producto
      const proveedorProducto = await db.query("find", "proveedores", {_id: producto[0].id_proveedor}, {correo: 1});
      
      // Obtener información del pedido
      const proveedorPedido = await db.query("find", "pedidos", {_id: db.objectID(id_carrito)}, {proveedor: 1});
      
      let darAviso = false;
  
      // Verificar si el proveedor ha cambiado y actualizar el pedido
      if (proveedorProducto[0].correo !== proveedorPedido[0].proveedor) {
        await db.query("update", "pedidos", {_id: db.objectID(id_carrito)}, {$set: {proveedor: proveedorProducto[0].correo, descripcion: []}});
        darAviso = proveedorPedido[0].proveedor !== "";
        console.log("DarAviso: " + darAviso);
        console.log(proveedorPedido[0].proveedor);
      }
  
      // Agregar producto al pedido
      const resultado = await db.query("update", "pedidos", {_id: db.objectID(id_carrito)}, {$push: {descripcion: {producto: {id_producto: db.objectID(id_producto), nombre: producto[0].nombre, precio: producto[0].precio}, cantidad: 1}}});
      
      res.json({status: 'success', dar_aviso: darAviso, resultado});
    } catch (error) {
      console.error('Error en la consulta:', error);
      res.status(500).json({status: 'error', message: 'Ocurrió un error en el servidor.'});
    }
  });

  router.post('/changePassword/:previousPass/:newPass/:userType/:id', verifyToken, async (req, res) => {
    const previousPass = req.params.previousPass;
    const newPass = req.params.newPass;
    const userType = req.params.userType
    const id_usuario = req.params.id

    try{

        const resultado = await db.query("update", userType ,{_id: db.objectID(id_usuario) ,"contraseña":previousPass},{$set:{"contraseña":newPass}})
        
        if(resultado.modifiedCount>0){
            res.json({status: 'success'});
        }

    }catch (error){
        
        console.error('Error en la consulta:', error);
        return res.status(500).send("Error al actualizar la contraseña");
    }
});
  
router.post('/deleteAccount/:password/:id/:userType', verifyToken, async (req, res) => {
    const enteredPassword = req.params.password;
    const id = req.params.id;
    const userType = req.params.userType

    console.log(enteredPassword);
    console.log(id);
    console.log(userType);

    if(userType==='proveedores'){
        //borra la cuenta que coincida en id y contraseña en proveedores
        const resultado = await db.query("deleteOne","proveedores",{_id: db.objectID(id),"contraseña":enteredPassword})
        if(resultado.deletedCount>0){
            const resBorrarProducts = await db.query("deleteMany","productos",{id_proveedor: db.objectID(id)})
            if(resBorrarProducts.acknowledged){
                const resBrkLink = await db.query("update","clientes",{},{$pull:{proveedores:{id_proveedor:db.objectID(id)}}})
                if(resBrkLink.acknowledged){
                    res.json({status: 'success'});
                }else{
                    res.status(500).send("Error al desenlazar el proveedor con sus clientes")
                }
            }else{
                res.status(500).send("Error al borrar los productos del proveedor");
            }
        }else{
            res.status(500).send("Error al borrar la cuenta");
        }
    }else{
        //borra la cuenta que coincida en id y contraseña en proveedores
        const infoCliente = await db.query("find","clientes",{_id: db.objectID(id),"contraseña":enteredPassword},{_id:0,correo:1})
        const resultado = await db.query("deleteOne","clientes",{_id: db.objectID(id),"contraseña":enteredPassword})
        if(resultado.deletedCount>0){
            const resBorrarCarrito = await db.query("deleteMany","pedidos",{cliente:infoCliente[0].correo,estdo:"Carrito"})
            if(resBorrarCarrito.acknowledged){
                    res.json({status: 'success'});
            }else{
                res.status(500).send("Error al borrar el carrito del cliente");
            }
        }else{
            res.status(500).send("Error al borrar la cuenta");
        }
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
        if (cliente.modifiedCount > 0) {
            return res.status(201).json({ message: `Campo ${campo} actualizado con éxito, nuevo valor: ${newValue}`});
        }else{
            res.sendStatus(404);
        }
    }

    if (userType === 'proveedor') {
        // Actualiza la info del proveedor
        const proveedor = await db.query("update", "proveedores", { _id: db.objectID(id) }, {$set:data});
        if (proveedor.modifiedCount > 0) {
            return res.status(201).json({ message: `Campo ${campo} actualizado con éxito, nuevo valor: ${newValue}`});
        }else{
            res.sendStatus(404);
        }
    }

    res.sendStatus(403);
});

module.exports = router;
