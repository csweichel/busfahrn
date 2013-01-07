
var crypto = require('crypto');

function Auth(users) {
    this._users = users;
}

Auth.prototype.mayPost = function(user, hash, message) {
    if(!this._users.hasOwnProperty(user)) return false;
    
    var our_hash = crypto.createHmac("sha1", this._users[user]).update(message).digest("hex");
    return our_hash == hash;
};
Auth.prototype.mayListen = function(user, hash, type) {
    return this.mayPost(user, hash, type);  
};

module.exports = Auth;
