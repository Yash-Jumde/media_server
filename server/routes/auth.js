router.post('/login', async (req, res) => {
    const {username, password} = req.body;
    const user = await db.getUserByUsername(username);

    if(user && await bcrypt.compare(password, user.password_hash)) {
        const token = jwt.sign(
            { id: user.id, username: user.username},
            process.env.JWT_SECRET,
            { expiresIn: '24h'}
        );
        res.json({token, user: {id: user.id, username: user.username}});
    } else {
        res.status(401).json({error: 'Invalid Credentials'});
    }
});
