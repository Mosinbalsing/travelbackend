class UserModel {
    constructor(user){
        this.username = user.username;
        this.name = user.name;
        this.email = user.email;
        this.mobile = user.mobile;
        this.password = user.password;
        this.created_at = new Date();
        this.updated_at = new Date();
    }
}
module.exports = { UserModel };