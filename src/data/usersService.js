const path = require('path');
const fs = require('fs');
const db = require('./models')
const {validationResult} = require('express-validator');
const bcryptjs = require('bcryptjs');
const usersService = {
    createUser: async function (req, res){
        try{       
            let resultValidation = validationResult(req);
    
            if(resultValidation.errors.length > 0){
                return res.render('register', {
                    errors: resultValidation.mapped(),
                    old: req.body
                });
            }


            let userExists = await db.Users.findOne({where:{
                email: req.body.email
            }});

            if(userExists != null){
                // res.send("El mail ingresado ya se encuentra registrado")
                return res.render('register', {
                    errors: {
                        email: {
                            msg: "Ese email ya está registrado"
                        }
                    },
                    old: req.body
                })
            }
          
            // verificar si ambas pass del registro son iguales
            let hashedPass = bcryptjs.hashSync(req.body.password, 10);
            let equalPass = bcryptjs.compareSync(req.body.repPassword, hashedPass)

            // Si no se carga una imagen, guarda una imagen default
            let avatarImage = ""
            if(!req.file || req.file == undefined){ 
                avatarImage = "avatar-default.png"
            } else {
                avatarImage = req.file.filename;
            }

            if(equalPass){
                let user = await db.Users.create({
                        email: req.body.email.trim(),
                        user_name: req.body.username.trim(),
                        password: hashedPass,
                        name: req.body.realName.trim(),
                        last_name: req.body.surname.trim(),
                        birthdate: req.body.birthDate,
                        avatar: avatarImage,
                        rol_id: 1                
                    });
                res.redirect('/login')
            } else {
                // res.status(400).json({ error: "Las contraseñas no coinciden." });
                return res.render('register', {
                    errors: {
                        repPassword: {
                            msg: "Las contraseñas no coinciden"
                        }
                    }
                })
            }

            if (req.body.password.length < 8){
                return res.render('register', {
                    errors: {
                        password: {
                            msg: "La contraseña debe tener como mínimo 8 caracteres"
                        }
                    }
                })
            }
                      
        } catch(error) {
            res.status(400).json({ error: "Ha ocurrido un error inesperado." });
        }
    },

    editUser: async function(req, res){
        try{
            let userToEdit = await db.Users.findByPk(req.params.id);
            let resultValidation = validationResult(req);

            if(resultValidation.errors.length > 0){
                res.status(400).json({ error: resultValidation.mapped() });
            }

            let avatarImage = "";
            let pass = "";
            if(!req.file || req.file == undefined){ 
                avatarImage = userToEdit.avatar;
            } else {
                avatarImage = req.file.filename;
            }

            if(req.body.password == ""){
                pass = userToEdit.password; // Si no se cambia la pass, no se actualiza
            } else {
                if(req.body.password == req.body.repPassword){
                    pass = bcryptjs.hashSync(req.body.password, 10);
                } else {
                    res.status(400).json({ error: "Las contraseñas no coinciden." });
                }
            } 

            await db.Users.update({
                email: req.body.email.trim(),
                user_name: req.body.username.trim(),
                password: pass,
                name: req.body.realName.trim(),
                last_name: req.body.surname.trim(),
                birthdate: req.body.birthDate,
                avatar: avatarImage,
                rol_id: 1                
            },                
                {where:{
                    id : req.params.id
                }
            })

            res.redirect('/users/profile')
            

        } catch (err){
            res.status(400).json({ error: "Ha ocurrido un error inesperado." });
        }


    },

    deleteUser: async function(req, res){
        try{
            await db.Users.destroy({
                where:{
                    id : req.params.id}
            })
            req.session.userLogged = null
            res.status(200).json({"success": "Usuario eliminado"})

        } catch(error) {
            console.log(error);
            res.status(400).json({"Ocurrio un error": error})
        }
    },
    
    viewProfile: async function(req, res){
        try{
            if(req.session.userLogged && req.session.userLogged.rol_id == 2){
                let user = await db.Users.findByPk(req.session.userLogged.id);
                let users = await db.Users.findAll();
                let products = await db.Products.findAll();
                // console.log(req.session.userLogged);
                res.render('adminProfile', {user: user, products: products, users:users})
            } else if(req.session.userLogged && req.session.userLogged.rol_id == 1) {
                let user = await db.Users.findByPk(req.session.userLogged.id);
                res.render('userProfile', {user})
            } else {
                res.redirect('/login')
            }            

        } catch(error) {
            console.log(error);
            res.status(400).json({"Ocurrio un error": error})

        }
    },

    adminForm: async function(req, res){
        try{
            if(req.body.admin == "admin"){
                await db.Users.update({
                    rol_id : 2},
                    {
                        where:{
                            id: req.body.id}
                        }
                )                    
            } else {
                await db.Users.update({
                    rol_id : 1},
                    {
                        where:{
                            id: req.body.id}
                        }
                )
            }
            res.redirect('/users/profile')

        } catch(error) {
            console.log(error);
            res.status(400).json({"Ocurrio un error": error})
        }

    },

    processLogin: async function(req, res){
        const userToLogin = await db.Users.findOne({
            where:{
                email: req.body.email
            }
        });

        if(userToLogin == null){
            // res.send('Usuario no encontrado')
            return res.render('login', {
                errors: {
                    email: {
                        msg: "Usuario no encontrado"
                    }
                }
            })
        }

        if(bcryptjs.compareSync(req.body.password, userToLogin.password)){
            req.session.userLogged = userToLogin;
            if(req.body.Recordarme != undefined) {
            res.cookie('Recordarme', req.session.userLogged.email, {maxAge: 86400000})}
            res.redirect('/users/profile')
            
        } else {
            // res.send("Credenciales invalidas");
            return res.render('login', {
                errors: {
                    email: {
                        msg: "Credenciales inválidas"
                    }
                }
            })
        }
    },

    logOut: function(req, res){
        req.session.destroy();
        res.clearCookie("Recordarme")
        res.redirect('/')
    },

    viewAllUsers: async function(req, res){
        if(req.session.userLogged && req.session.userLogged.rol_id == 2){
            let users = await db.Users.findAll();
            res.render('allUsers', {users: users})
        } else {
            res.status(400).json({"error": "Ups! No tienes permiso para ver esta pagina"})
        }
    }
}

module.exports = usersService;