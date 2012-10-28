module.exports = function () {
    var n = Math.floor(Math.random() * Math.pow(16, 8));
    return '_' + Date.now() + '_' + n.toString(16);
};
