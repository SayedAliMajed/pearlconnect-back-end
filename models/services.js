
import mongoose from "mongoose";

const imageSchema = new mongoose.Schema({
url: {
type: String,
required: true,
},
alt: {
type: String,
},
});

const serviceSchema = new mongoose.Schema({

title: {
type: String,
required: true,
trim: true,
},

description: {
type: String,
required: true,
},

price: {
type: Number,
required: true,
min: 0,
},

category: {
type: mongoose.Schema.Types.ObjectId,
ref: "Category",
required: false, 
},

provider: {
type: mongoose.Schema.Types.ObjectId,
ref: "User",
required: true,
},

images: [imageSchema], 
createdAt: {
type: Date,
},
});

const Service = mongoose.model("Service", serviceSchema);
export default Service;