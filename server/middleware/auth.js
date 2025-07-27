const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    // Check for token in Authorization header
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];
    
    // If not found, check for token in query parameters
    if (!token) {
        token = req.query.token;
    }

    if(!token){
        return res.status(401).json({error: 'Access token required'});
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if(err) return res.status(403).json({error: 'Invalid token'});
        req.user = user;
        next();
    });
};

module.exports = {authenticateToken};