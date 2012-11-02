module.exports = function () {
    // same as require('scuttlebutt/util').createId()
    
    return [1,1,1].map(function () {
        return Math.random().toString(16).substring(2).toUpperCase();
    }).join('');
};
