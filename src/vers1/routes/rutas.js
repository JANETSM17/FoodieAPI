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
        const proveedor = await db.query("find", "proveedores", { _id: db.objectID(id) }, { _id: 1, nombre: 1, correo: 1, telefono: 1, imagen: 1, direccion: 1, calif: 1, min_espera: 1, clave: 1,active: 1 });
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

        const clientes = await db.query("find","clientes",{$or:[{telefono:telefono},{correo:correo}]},{})
        let proveedores = null

        if(userType === 'Usuario'){
            proveedores = await db.query("find","proveedores",{$or:[{telefono:telefono},{correo:correo}]})
        }else{
            proveedores = await db.query("find","proveedores",{$or:[{telefono:telefono},{correo:correo},{rfc:rfc},]})
        }
        

        if (clientes.length > 0 || proveedores.length > 0) {
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
                imagen: 'https://res.cloudinary.com/foodiecloudinary/image/upload/v1722136335/FoxClient_vmriqx.jpg',
                active: true,
                proveedores: []
            } : {
                nombre: nombre_empresa,
                correo: correo_corporativo,
                contraseña: contraseña,
                telefono: telefono,
                created_at: new Date(),
                imagen: 'https://res.cloudinary.com/foodiecloudinary/image/upload/v1722136539/cubiertos_mgulnb.png',
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
            const info = await db.query("find", "proveedores", { _id: { $in: idsComedores }, active: true }, { _id: 1, nombre: 1, calif: 1, min_espera: 1, imagen: 1 });
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
  
router.post('/deleteAccount/:password/:id/:userType/:email', verifyToken, async (req, res) => {
    const enteredPassword = req.params.password;
    const id = req.params.id;
    const userType = req.params.userType
    const email = req.params.email

    console.log(enteredPassword);
    console.log(id);
    console.log(userType);

    if(userType==='proveedores'){
        //borra la cuenta que coincida en id y contraseña en proveedores
        const resultado = await db.query("deleteOne","proveedores",{_id:db.objectID(id),"contraseña":enteredPassword})
        if(resultado.deletedCount>0){
            const resBorrarProducts = await db.query("deleteMany","productos",{id_proveedor:db.objectID(id)})
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
        const resultado = await db.query("deleteOne","clientes",{_id:db.objectID(id),"contraseña":enteredPassword})
        if(resultado.deletedCount>0){
            const dltBag = await db.query("deleteOne","pedidos",{cliente:email,estado:{$in:["Carrito","En proceso", "Listo para recoger"]}})
            if (dltBag.deletedCount>0){
                res.json({status: 'success'});
            }else{
                return res.status(500).send("Error al borrar el carrito");
            }
            
        }else{
            return res.status(500).send("Error al borrar la cuenta");
        }
    }
});

router.get('/getProductos/:idCarrito', verifyToken, async (req,res) => {
    console.log('inicia la consulta del carrito')
    const idCarrito = req.params.idCarrito
    console.log(idCarrito)
    const infoProductos = await db.query("aggregation","pedidos",[{$match:{_id:db.objectID(idCarrito)}},{$unwind:"$descripcion"},{$lookup:{from:"productos",localField:"descripcion.producto.id_producto",foreignField:"_id",as:"infoProducto"}},{$project:{_id:0,cantidad:"$descripcion.cantidad",infoProducto:1}},{$unwind:"$infoProducto"},{$project:{cantidad:1,_id:"$infoProducto._id",nombre:"$infoProducto.nombre",precio:"$infoProducto.precio",imagen:"$infoProducto.imagen"}}])

    //const infoProductos = await db.query("find","productos",{_id:{$in:ids[0].ids}},{_id:1,nombre:1,imagen:1,precio:1})

    res.json(infoProductos)
})

router.get('/deleteProducto/:idProducto/:idCarrito', verifyToken, async (req,res) => {
    const idProducto = req.params.idProducto;
    const idCarrito = req.params.idCarrito;
    console.log(idProducto)
    console.log(idCarrito)

    try{
        console.log('Inicia la eliminacion del producto del carrito')
        const resultado = await db.query("update","pedidos",{_id:db.objectID(idCarrito)},{$pull:{descripcion:{"producto.id_producto":db.objectID(idProducto)}}})
        if(resultado.acknowledged){
            res.json({status: 'success'});
        }
    }catch(error){
        console.error("Error deleting from cart:", error);
        res.status(500).json({ message: "Internal server error" });
    }
})

router.get('/modifyQuantityProducto/:idProducto/:idCarrito/:cantidad', verifyToken, async (req,res) => {
    const idProducto = req.params.idProducto;
    const cantidad = +req.params.cantidad;
    const idCarrito = req.params.idCarrito;

    console.log(idProducto)
    console.log(idCarrito)
    console.log(cantidad)

    try{
        console.log('Inicia el actualizar')
        resultado = await db.query("update","pedidos",{_id:db.objectID(idCarrito)},{$set:{"descripcion.$[elem].cantidad":cantidad}},{arrayFilters:[{"elem.producto.id_producto":db.objectID(idProducto)}]})
        if(resultado.acknowledged){
            res.json({status: 'success'});
        }
    }catch(error){
        console.error("Error changing quantity:", error);
        res.status(500).json({ message: "Internal server error" });
    }
})

router.post('/editInfoClient/:nombre/:telefono/:id', verifyToken, async (req, res) => {
    const nombre = req.params.nombre;
    const telefono = req.params.telefono;
    const id_usuario = req.params.id;

    try {
        // Verificar si el teléfono ya está asociado con otra cuenta
        const clientes = await db.query("find", "clientes", { telefono: telefono, _id: { $ne: db.objectID(id_usuario) } }, {});
        const proveedores = await db.query("find", "proveedores", { telefono: telefono, _id: { $ne: db.objectID(id_usuario) } }, {});
    
        if (clientes.length > 0 || proveedores.length > 0) {
            return res.status(400).json({ status: 'error', message: 'El telefono que ingresaste ya está asociado a otra cuenta' });
        }

        // Realizar la actualización si el teléfono no está en uso
        const resultado = await db.query("update", "clientes", { _id: db.objectID(id_usuario) }, { $set: { "telefono": telefono, "nombre": nombre } });

        if (resultado.modifiedCount > 0) {
            res.json({ status: 'success' });
        } else {
            res.status(500).send("Error al actualizar la información");
        }

    } catch (error) {
        console.error('Error en la consulta:', error);
        return res.status(500).send("Error al actualizar la información");
    }
});

router.post('/editInfoProveedor/:direccion/:telefono/:id', verifyToken, async (req, res) => {
    const direccion = decodeURIComponent(req.params.direccion);
    const telefono = decodeURIComponent(req.params.telefono);
    const id_usuario = decodeURIComponent(req.params.id);
  
    try {

      // Verificar si el teléfono ya está asociado con otra cuenta
      const clientes = await db.query("find", "clientes", { telefono: telefono, _id: { $ne: db.objectID(id_usuario) } }, {});
      const proveedores = await db.query("find", "proveedores", { telefono: telefono, _id: { $ne: db.objectID(id_usuario) } }, {});
  
      if (clientes.length > 0 || proveedores.length > 0) {
        return res.status(400).json({ status: 'error', message: 'El telefono que ingresaste ya está asociado a otra cuenta' });
      }
  
      // Realizar la actualización si el teléfono no está en uso
      const resultado = await db.query("update", "proveedores", { _id: db.objectID(id_usuario) }, { $set: { "telefono": telefono, "direccion": direccion } });
  
      if (resultado.modifiedCount > 0) {
        res.json({ status: 'success' });
      } else {
        res.status(500).json({ status: 'error', message: 'Error al actualizar la información' });
      }
    } catch (error) {
      console.error('Error en la consulta:', error);
      res.status(500).json({ status: 'error', message: 'Error al actualizar la información' });
    }
  });

  router.post('/editTimePreparation/:time/:id', verifyToken, async (req, res) => {
    const timePreparation = +req.params.time; 
    const id_usuario = req.params.id;

    try {
        const resultado = await db.query("update", "proveedores", { _id: db.objectID(id_usuario) }, { $set: { "min_espera": timePreparation } });

        if (resultado.modifiedCount > 0) {
            res.json({ status: 'success' });
        } 

    } catch (error) {
        console.error('Error en la consulta:', error);
        return res.status(400).json({ status: 'error', message: 'Error al cambiar el teimpo de preparación, ingresa un numero valido' });
    }
});

router.post('/editClave/:newCode/:id', verifyToken, async (req, res) => {
    const newClave = req.params.newCode; 
    const id_usuario = req.params.id;

    console.log('Esta es la nueva clave', newClave)

        // Primero verifica si la nueva clave ya existe
        const claveExistente = await db.query("find", "proveedores", 
            { clave: newClave, _id: { $ne: db.objectID(id_usuario) } }, 
            { clave: 1, _id: 0 }
        );

        console.log('Clave existente:', claveExistente);

        if (claveExistente.length > 0) {
            // Si la clave ya existe, retorna un error
            return res.status(400).json({ status: 'error', message: 'Esa clave ya le pertenece a otro proveedor' });
        }

        const resultado = await db.query("update", "proveedores", { _id: db.objectID(id_usuario) }, { $set: { "clave": newClave } });

        if (resultado.modifiedCount > 0) {
            const resBrkLink = await db.query("update","clientes",{},{$pull:{proveedores:{id_proveedor:db.objectID(id_usuario)}}})
                if(resBrkLink.acknowledged){
                    res.json({status: 'success'});
                }else{
                    res.status(400).json({ status: 'error', message: 'Error al desenlazar el proveedor con sus clientes' });
                }
        } else {
            res.status(400).json({ status: 'error', message: 'No se pudo actualizar la clave' });
        }
});

router.post('/updateSwitchState/:id', verifyToken, async (req, res) => {
    console.log("Inicia la actualizacion de estado")
    const newState = req.body.newState; //===1?true:false; // Obtener el nuevo estado del cuerpo de la solicitud
    const id = req.params.id
    console.log('Este es el nuevo estado', newState)
    // Actualizar el estado en la base de datos
    const resultado = await db.query("update","proveedores",{_id:db.objectID(id)},{$set:{active:newState}})
    if(resultado.modifiedCount>0){
        res.json({status: 'success'});
    }else{
        res.status(400).json({ status: 'error', message: 'No se pudo actualizar el estado del comedor' });
    }
});

router.get('/confirmarFoodieBox/:idCarrito', verifyToken, async (req, res) => {
    const id_carrito = req.params.idCarrito;
  
    try {
      const proveedorPedido = await db.query("find", "pedidos", { _id: db.objectID(id_carrito) }, { proveedor: 1 });
  
      let dateLimit = new Date();
      console.log('Esta es la fecha actual', dateLimit);
      dateLimit.setMinutes(dateLimit.getMinutes() - 5);
  
      const ping = await db.query("aggregation", "proveedores", [
        { $match: { correo: proveedorPedido.proveedor } },
        { $lookup: { from: "foodieboxes", localField: "foodiebox", foreignField: "numSerie", as: "infoFoodieBox" } },
        { $project: { ping: "$infoFoodieBox.ping" } },
        { $unwind: "$ping" }
      ]);
  
      const isActive = ping.length > 0 && ping[0].ping > dateLimit;

      console.log(isActive);
  
      res.json({ status: isActive });
    } catch (error) {
      console.error('Error confirming FoodieBox:', error);
      res.status(500).json({ status: false, error: 'Internal Server Error' });
    }
  });

  router.get('/confirmarPedidos/:email', verifyToken, async (req,res) => {
    const email = req.params.email
    console.log('inicia la confirmacion')
    const estados = ["Esperando confirmacion","En proceso","Listo para recoger"]
    const resultado = await db.query("find","pedidos",{cliente:email,estado:{$in:estados}})
    console.log(resultado.length)
    res.json({cuenta:resultado.length})
})

router.get('/confirmarEspera/:idCarrito', verifyToken, async (req, res) => {
    const carrito = req.params.idCarrito;
    console.log('Inicia la confirmación del tiempo de espera');

    try {
        const resultado = await db.query("aggregation", "pedidos", [
            { $match: { _id: db.objectID(carrito) } },
            { $lookup: { from: "proveedores", localField: "proveedor", foreignField: "correo", as: "proveedorInfo" } },
            { $project: { min_espera: "$proveedorInfo.min_espera" } }
        ]);

        res.json(resultado);
    } catch (error) {
        console.error('Error al confirmar el tiempo de espera:', error);
        res.status(500).json({ message: 'Error al confirmar el tiempo de espera' });
    }
});

router.get('/enviarPedido/:idCarrito/:espera/:especificaciones/:pickup/:email', verifyToken, async (req, res) => {
    try {
        const idCarrito = req.params.idCarrito;
        const espera = +req.params.espera;
        const especificaciones = decodeURI(req.params.especificaciones);
        const pickup = req.params.pickup;
        const email = req.params.email;
        let clave;
        
        if (pickup === "mostrador") {
            clave = "N/A";
        } else {
            const clavesEnUso = await db.query("find", "pedidos", {}, { clave: 1, _id: 0 });
            clave = crearClave();
            while (clavesEnUso.some(elem => elem.clave == clave)) {
                clave = crearClave();
            }
        }

        // if (especificaciones.length==0){
        //     especificaciones="Pedido sin especificaciones especiales";
        //   }

        console.log('Inicia el envío del pedido');
        let date = new Date();
        console.log(date);
        date.setMinutes(date.getMinutes() + espera);
        console.log(date);

        const resultado = await db.query("update", "pedidos", { _id: db.objectID(idCarrito) }, {
            $set: {
                estado: "Esperando confirmacion",
                entrega: date,
                especificaciones: especificaciones,
                pickup: pickup,
                clave: clave
            }
        });

        const nuevoCarrito = await db.query("insert", "pedidos", {
            cliente: email,
            estado: "Carrito",
            proveedor: "",
            especificaciones: "",
            descripcion: [],
            especificaciones: ""
        });

        console.log(nuevoCarrito);
        res.json(resultado);
    } catch (error) {
        console.error('Error al enviar el pedido:', error);
        res.status(500).json({ error: 'Error al enviar el pedido' });
    }
});

router.get('/getPedidosHist/:correo/:userType', verifyToken, async (req, res) => {
    try {
      const email = req.params.correo;
      const estados = ["Entregado"];
      const userType = req.params.userType

      if(userType === "proveedor"){

        const infoPedidos = await db.query("aggregation", "pedidos", [
            { $match: { proveedor: email, estado: { $in: estados } } },
            { $lookup: { from: "clientes", localField: "cliente", foreignField: "correo", as: "infoCliente" } }, {$unwind:"$infoCLiente"}
        ]);
    
        let resultado = [];
        infoPedidos.forEach(pedido => {
            let total = 0;
            let descripcion = "";
            pedido.descripcion.forEach(articulo => {
            total += (articulo.producto.precio * articulo.cantidad);
            descripcion += `${articulo.producto.nombre} x${articulo.cantidad},`;
            });
            descripcion = descripcion.slice(0, -1);
            let id = pedido._id.toString();
            let fecha = pedido.entrega
            fecha.setHours(fecha.getHours()-6)
    
            resultado.push({
            _id: id,
            numerodepedido: id.substring(id.length - 8, id.length - 2).toUpperCase(),
            nombre: pedido.infoCliente.nombre,
            total: total,
            descripcion: descripcion,
            hora: fecha.toLocaleString(),
            especificaciones: pedido.especificaciones,
            pickup: pedido.pickup=="mostrador"?"Mostrador":"FoodieBox",
            ruta : pedido.infoCliente.imagen
            });

            console.log('Nombre: '+ pedido.infoCliente[0].nombre)
            console.log('Ruta: '+ pedido.infoCliente[0].imagen)
        });
        res.json(resultado);
      }else{
        const pedidosInfo = await db.query("aggregation","pedidos",[{$match:{cliente: email ,estado:{$in:estados}}},{$lookup:{from:"proveedores",localField:"proveedor",foreignField:"correo",as:"infoProveedor"}},{$project:{estado:1,descripcion:1,entrega:1,pickup:1,especificaciones:1,"infoProveedor.nombre":1,"infoProveedor.imagen":1,_id:1}},{$sort:{entrega:-1}}])
        let resultado = []
        let total = 0
        pedidosInfo.forEach(pedido=>{
            let precio = 0
            let descripcion = ""
            pedido.descripcion.forEach(articulo=>{
                precio += (articulo.producto.precio*articulo.cantidad)
                descripcion += `${articulo.producto.nombre} x${articulo.cantidad},`
            })
            descripcion = descripcion.slice(0,-1)
            let id = pedido._id.toString();
            total += precio
            let fecha = pedido.entrega
            fecha.setHours(fecha.getHours()-6)
            resultado.push(
                {
                    _id: id,
                    total: precio,
                    hora: fecha.toLocaleString(),
                    ruta:pedido.infoProveedor[0].imagen,
                    descripcion: descripcion,
                    especificaciones: pedido.especificaciones,
                    pickup: pedido.pickup,
                    proveedor: pedido.infoProveedor[0].nombre
                }
            )
        })
        res.json({res:resultado,total:total})
      }
    } catch (error) {
      console.error("Error fetching pedidos historicos:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get('/pedidosEnCurso/:id/:email', verifyToken, async (req,res) => {
    //Esto es del cliente
    const id = req.params.id;
    const email = req.params.email;

    console.log('inicia el query')
    const userInfo = await db.query("find","clientes",{_id:db.objectID(id)},{nombre:1,telefono:1,_id:0})
    const estados = ["Esperando confirmacion","En proceso","Listo para recoger","Cancelado", "Rechazado"]
    const pedidoInfo = await db.query("aggregation","pedidos",[{$match:{cliente: email,estado:{$in:estados}}},{$sort:{entrega:-1}},{$limit:1},{$lookup:{from:"proveedores",localField:"proveedor",foreignField:"correo",as:"infoProveedor"}},{$project:{_id:1,especificaciones:1,descripcion:1, entrega:1,estado:1,clave:1,pickup:1,imagen:"$infoProveedor.imagen",nombre:"$infoProveedor.nombre",telefono:"$infoProveedor.telefono"}},{$unwind:"$nombre"},{$unwind:"$telefono"},{$unwind:"$imagen"}])
    let resultado = []
    pedidoInfo.forEach(pedido=>{
        let total = 0
        let descripcion = ""
        pedido.descripcion.forEach(articulo=>{
            total += (articulo.producto.precio*articulo.cantidad)
            descripcion += `${articulo.producto.nombre} x${articulo.cantidad},`
        })
        descripcion = descripcion.slice(0,-1)
        let id = pedido._id.inspect()
        let fecha = pedido.entrega
            fecha.setHours(fecha.getHours()-6)
        resultado.push(
            {
                id:id.substring(id.length-8,id.length-2).toUpperCase(),
                nombre: pedido.nombre,
                telefono: pedido.telefono,
                especificaciones: pedido.especificaciones,
                total: total,
                descripcion: descripcion,
                entrega: fecha.toLocaleString(),
                status: pedido.estado,
                clave: pedido.clave,
                pickup: pedido.pickup=="mostrador"?"Mostrador":"Foodie-box",
                ruta:pedido.imagen
            }
        )
    })
    res.json(resultado)
});


router.get('/pedidosProveedor/:email', verifyToken, async (req,res)=>{
    const email = req.params.email
    const estados = ["Esperando confirmacion","En proceso","Listo para recoger"]

    const infoPedidos = await db.query("aggregation","pedidos",[{$match:{proveedor: email, estado:{$in:estados}}},{$lookup:{from:"clientes",localField:"cliente",foreignField:"correo",as:"infoCliente"}},{$sort:{entrega:1}}])
    let resultado = []
    infoPedidos.forEach(pedido=>{
        let total = 0
        let descripcion = ""
        pedido.descripcion.forEach(articulo=>{
            total += (articulo.producto.precio*articulo.cantidad)
            descripcion += `${articulo.producto.nombre} x${articulo.cantidad},`
        })
        descripcion = descripcion.slice(0,-1)
        let id = pedido._id.toString()
        let fecha = pedido.entrega
            fecha.setHours(fecha.getHours()-6)

        resultado.push({
            id: id,
            orderNumber:id.substring(id.length-6,id.length).toUpperCase(),
            image: pedido.infoCliente[0].imagen,
            customerName: pedido.infoCliente[0].nombre,
            phoneNumber: pedido.infoCliente[0].telefono,
            specifications: pedido.especificaciones,
            total: total,
            items: descripcion,
            pickupTime: fecha.toLocaleString(),
            deliveryType: pedido.pickup=="mostrador"?"Mostrador":"FoodieBox",
            clave: pedido.clave,
            status: pedido.estado
        })
    })
    res.json(resultado)
})

router.get('/aceptarPedido/:id', verifyToken, async (req,res)=>{
    const id = req.params.id;
    const resultado = await db.query("update","pedidos",{_id:db.objectID(id)},{$set:{estado:"En proceso"}})

    if(resultado.modifiedCount > 0){
        res.json({status: "done"})
    }
    
})

router.get('/rechazarPedido/:id', verifyToken, async (req,res)=>{
    const id = req.params.id;
    const resultado = await db.query("update","pedidos",{_id:db.objectID(id)},{$set:{estado:"Rechazado"}})

    if(resultado.modifiedCount > 0){
        res.json({status: "done"})
    }
})

router.get('/pedidoListo/:id', verifyToken, async (req,res)=>{
    const id = req.params.id;
    const resultado = await db.query("update","pedidos",{_id:db.objectID(id)},{$set:{estado:"Listo para recoger"}})

    if(resultado.modifiedCount > 0){
        res.json({status: "done"})
    }
})

router.get('/pedidoEntregado/:id', verifyToken, async (req,res)=>{
    const id = req.params.id;
    const resultado = await db.query("update","pedidos",{_id:db.objectID(id)},{$set:{estado:"Entregado"}})

    if(resultado.modifiedCount > 0){
        res.json({status: "done"})
    }
})

router.get('/productosProveedor/:id', verifyToken, async (req,res) => {
    const id_usuario = req.params.id;

    try{

        const resultado = await db.query("find","productos",{id_proveedor:db.objectID(id_usuario)},{categoria:1,nombre:1,precio:1,descripcion:1,imagen:1,id:'$_id',active:1})

        res.json(resultado)
    }catch(error){
        res.json({status: "error"})
    }
    
});

router.post('/updateSwitchStateProducto/:id', verifyToken, async (req, res) => {
    console.log("Inicia la actualizacion de estado")
    const newState = req.body.newState; 
    const id = req.params.id
    console.log('Este es el nuevo estado', newState)
    // Actualizar el estado en la base de datos
    const resultado = await db.query("update","productos",{_id:db.objectID(id)},{$set:{active:newState}})
    if(resultado.modifiedCount>0){
        res.json({status: 'success'});
    }else{
        res.status(400).json({ status: 'error', message: 'No se pudo actualizar el estado del comedor' });
    }
});

router.post('/eliminarProducto/:id', verifyToken, async (req, res) => {
    const id = req.params.id;
    console.log("Se borra el producto")
    const resultado = await db.query("deleteOne","productos",{_id:db.objectID(id)})
    if(resultado.deletedCount > 0){
        res.json({status: 'success'});
    }else{
        res.status(500).send("Error al eliminar el producto");
    }
});

router.post('/updateProducto/:id/:nombre/:descripcion/:precio/:categoria', verifyToken, async (req, res) => {
    console.log("Inicia la actualizacion del producto")

    const id = req.params.id;
    const nombre = req.params.nombre;
    const descripcion = decodeURI(req.params.descripcion);
    const precio = +req.params.precio;
    const categoria = req.params.categoria;

    let ruta
    switch (categoria) {
        case "comida":
            ruta = "https://res.cloudinary.com/foodiecloudinary/image/upload/v1722137391/hamburger_kvhvjh.png"
            break;
        case "bebidas":
            ruta = "https://res.cloudinary.com/foodiecloudinary/image/upload/v1722137401/smoothie2_b9bzob.png"
            break;
        case "dulces":
            ruta = "https://res.cloudinary.com/foodiecloudinary/image/upload/v1722137520 chocolate-bar-icon-bitten-pieces-600nw-2256291305_nu4re7.jpg"
            break;
        case "frituras":
            ruta = "https://res.cloudinary.com/foodiecloudinary/image/upload/v1722137375/chips_cbcwfu.png"
            break;
        case "otros":
            ruta = "https://res.cloudinary.com/foodiecloudinary/image/upload/v1722137836/estrella_ixt70l.png"
            break;
        default:
            res.status(500).send("Categoria invalida");
            break;
    }
    
    // Actualizar el producto en la base de datos
    const resultado = await db.query("update","productos",{_id:db.objectID(id)},{
        $set:{
            nombre:nombre,
            precio:precio,
            descripcion:descripcion,
            categoria:categoria,
            imagen:ruta,
        }})
        
    if(resultado.modifiedCount>0){
        res.json({status: 'success'});
    }else{
        res.status(400).json({ status: 'error', message: 'No se pudo actualizar el producto' });
    }
});
  
module.exports = router;