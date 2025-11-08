const express = require('express');
const Category = require('../models/category');

const router = express.Router();

// allow enum for dropdown menu
const allowedNames = Category.schema.path('name').enumValues;

// create a category
router.post('/', async (req, res) => {
	try {
		const { name } = req.body;
		if (!name) return res.status(400).json({ err: 'name is required' });
		if (!allowedNames.includes(name)) {
			return res.status(400).json({ err: `Invalid category name. Allowed: ${allowedNames.join(', ')}` });
		}
		const existing = await Category.findOne({ name });
		if (existing) return res.status(409).json({ err: 'Category already exists' });
		const created = await Category.create({ name });
		return res.status(201).json(created);
	} catch (err) {
		console.log(err);
		return res.status(500).json({ err: 'Failed to create category' });
	}
});

// list all the categories :)
router.get('/', async (req, res) => {
	try {
		const categories = await Category.find({}, 'name createdAt');
		return res.json(categories);
	} catch (err) {
		return res.status(500).json({ err: err.message });
	}
});

// gert allowed names (enum values)
router.get('/names', (req, res) => {
	return res.json(allowedNames);
});

// get one category by id
router.get('/:id', async (req, res) => {
	try {
		const category = await Category.findById(req.params.id);
		if (!category) return res.status(404).json({ err: 'Category not found' });
		return res.json(category);
	} catch (err) {
		return res.status(500).json({ err: err.message });
	}
});

// update a category name
router.patch('/:id', async (req, res) => {
	try {
		const { name } = req.body;
		if (!name) return res.status(400).json({ err: 'name is required' });
		if (!allowedNames.includes(name)) {
			return res.status(400).json({ err: `Invalid category name. Allowed: ${allowedNames.join(', ')}` });
		}
		const duplicate = await Category.findOne({ name });
		if (duplicate && duplicate._id.toString() !== req.params.id) {
			return res.status(409).json({ err: 'Another category already uses that name' });
		}
		const updated = await Category.findByIdAndUpdate(
			req.params.id,
			{ name },
			{ new: true }
		);
		if (!updated) return res.status(404).json({ err: 'Category not found' });
		return res.json(updated);
	} catch (err) {
		return res.status(500).json({ err: err.message });
	}
});

// DELETE a category
router.delete('/:id', async (req, res) => {
	try {
		const deleted = await Category.findByIdAndDelete(req.params.id);
		if (!deleted) return res.status(404).json({ err: 'Category not found' });
		return res.json({ message: 'Category deleted', _id: deleted._id });
	} catch (err) {
		return res.status(500).json({ err: err.message });
	}
});

module.exports = router;
