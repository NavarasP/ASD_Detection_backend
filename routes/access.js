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

// POST /api/access/grant - Caretaker directly grants access via email
router.post('/grant', requireAuth, async (req, res) => {
  try {
    const { childId, doctorEmail } = req.body;
    const caretakerId = req.user.id;

    console.log('[Access Grant] Request:', { childId, doctorEmail, caretakerId });

    if (!childId || !doctorEmail) {
      return res.status(400).json({ error: 'childId and doctorEmail are required' });
    }

    // Verify child belongs to caretaker
    const child = await Child.findById(childId);
    if (!child) {
      return res.status(404).json({ error: 'Child not found' });
    }

    if (child.caretakerId.toString() !== caretakerId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You do not own this child profile' });
    }

    // Find doctor by email
    const doctor = await User.findOne({ email: doctorEmail.toLowerCase(), role: 'doctor' });
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found. Please verify the email address.' });
    }

    // Check if already authorized
    if (child.authorizedDoctors.some(docId => docId.toString() === doctor._id.toString())) {
      return res.status(400).json({ error: 'This doctor already has access' });
    }

    // Add doctor to authorized list
    child.authorizedDoctors.push(doctor._id);
    await child.save();

    console.log('[Access Grant] Success:', doctor.email);

    res.json({ 
      message: 'Access granted successfully',
      doctor: {
        _id: doctor._id,
        name: doctor.name,
        email: doctor.email
      }
    });
  } catch (err) {
    console.error('[Access Grant] Error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// POST /api/access/revoke - Caretaker revokes doctor access
router.post('/revoke', requireAuth, async (req, res) => {
  try {
    const { childId, doctorId } = req.body;
    const caretakerId = req.user.id;

    console.log('[Access Revoke] Request:', { childId, doctorId, caretakerId });

    if (!childId || !doctorId) {
      return res.status(400).json({ error: 'childId and doctorId are required' });
    }

    // Verify child belongs to caretaker
    const child = await Child.findById(childId);
    if (!child) {
      return res.status(404).json({ error: 'Child not found' });
    }

    if (child.caretakerId.toString() !== caretakerId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You do not own this child profile' });
    }

    // Remove doctor from authorized list
    child.authorizedDoctors = child.authorizedDoctors.filter(
      docId => docId.toString() !== doctorId
    );
    await child.save();

    console.log('[Access Revoke] Success');

    res.json({ message: 'Access revoked successfully' });
  } catch (err) {
    console.error('[Access Revoke] Error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

module.exports = router;
