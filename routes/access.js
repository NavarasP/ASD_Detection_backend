const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const AccessRequest = require('../models/AccessRequest');
const Child = require('../models/Child');
const User = require('../models/User');

// Doctor requests access to a child profile
router.post('/request', requireAuth, async (req, res) => {
  try {
    const { childId, message } = req.body;
    const doctorId = req.user.id;

    // Verify requester is a doctor
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can request access' });
    }

    // Verify child exists
    const child = await Child.findById(childId);
    if (!child) {
      return res.status(404).json({ message: 'Child not found' });
    }

    // Check if request already exists
    const existingRequest = await AccessRequest.findOne({
      doctorId,
      childId,
      status: { $in: ['pending', 'approved'] }
    });

    if (existingRequest) {
      return res.status(400).json({ 
        message: existingRequest.status === 'approved' 
          ? 'You already have access to this child profile'
          : 'A pending request already exists for this child'
      });
    }

    // Create access request
    const accessRequest = new AccessRequest({
      doctorId,
      childId,
      caretakerId: child.caretakerId,
      message: message || 'Requesting access to review assessment and provide consultation'
    });

    await accessRequest.save();

    res.json({ 
      message: 'Access request sent successfully',
      request: accessRequest
    });
  } catch (err) {
    console.error('Access request error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Caretaker views their pending access requests
router.get('/pending', requireAuth, async (req, res) => {
  try {
    const caretakerId = req.user.id;

    // Verify requester is a caretaker
    if (req.user.role !== 'caretaker') {
      return res.status(403).json({ message: 'Only caretakers can view access requests' });
    }

    const requests = await AccessRequest.find({
      caretakerId,
      status: 'pending'
    })
      .populate('doctorId', 'name email')
      .populate('childId', 'name dob')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    console.error('Get pending requests error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Caretaker approves or denies access request
router.put('/:requestId/respond', requireAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body; // 'approved' or 'denied'
    const caretakerId = req.user.id;

    if (!['approved', 'denied'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be approved or denied' });
    }

    const request = await AccessRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Access request not found' });
    }

    // Verify the caretaker owns this request
    if (request.caretakerId.toString() !== caretakerId) {
      return res.status(403).json({ message: 'Not authorized to respond to this request' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'This request has already been responded to' });
    }

    // Update request status
    request.status = status;
    request.respondedAt = new Date();
    await request.save();

    // If approved, add doctor to child's authorized list
    if (status === 'approved') {
      await Child.findByIdAndUpdate(
        request.childId,
        { $addToSet: { authorizedDoctors: request.doctorId } }
      );
    }

    res.json({ 
      message: `Access request ${status}`,
      request
    });
  } catch (err) {
    console.error('Respond to request error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Doctor views their access requests status
router.get('/my-requests', requireAuth, async (req, res) => {
  try {
    const doctorId = req.user.id;

    if (req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can view their requests' });
    }

    const requests = await AccessRequest.find({ doctorId })
      .populate('childId', 'name dob gender')
      .populate('caretakerId', 'name email')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    console.error('Get my requests error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get all access requests (caretaker can see all their children's requests)
router.get('/all', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    let requests;
    if (role === 'caretaker') {
      requests = await AccessRequest.find({ caretakerId: userId })
        .populate('doctorId', 'name email')
        .populate('childId', 'name dob')
        .sort({ createdAt: -1 });
    } else if (role === 'doctor') {
      requests = await AccessRequest.find({ doctorId: userId })
        .populate('childId', 'name dob gender')
        .populate('caretakerId', 'name email')
        .sort({ createdAt: -1 });
    } else {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(requests);
  } catch (err) {
    console.error('Get all requests error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
