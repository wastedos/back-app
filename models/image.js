const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema({
    imageType: {type: String},
    imageTitle: {type: String},
    image: {type: String},
    date: {type:Date, default: Date.now, },
})


// Create Models
const Image = mongoose.model('Image', imageSchema);


// Export Models
module.exports = {
    Image,
};
