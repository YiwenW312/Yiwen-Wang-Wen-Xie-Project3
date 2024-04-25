// This file contains the routes for sharing passwords with other users.

// Require necessary NPM packages
const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const Password = require('../models/Password')
const User = require('../models/User')
const ShareRequest = require('../models/ShareRequest')
const { decrypt } = require('../utils/cryptoHelper')
// Instantiate a Router
const router = express.Router()

// CREATE a new share request
router.post('/', async (req, res) => {
  try {
    const { fromUserId, toUsername, passwordId } = req.body
    const toUser = await User.findOne({ username: toUsername })
    if (!toUser) {
      return res.status(404).json({ message: 'User to share with not found.' })
    }
    const newShareRequest = new ShareRequest({
      from: fromUserId,
      to: toUser._id,
      passwordId: passwordId,
      status: 'pending'
    })
    await newShareRequest.save()
    res.status(200).json(newShareRequest)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// CREATE: accept Share Request
router.post('/:id/accept', async (req, res) => {
  try {
    const shareRequestId = req.params.id
    const shareRequest = await ShareRequest.findById(shareRequestId)
    if (!shareRequest) {
      return res.status(404).json({ message: 'Share request not found.' })
    }

    
    if (shareRequest.status === 'accepted') {
      return res.status(400).json({ message: 'Share request already accepted.' })
    }
    if (shareRequest.status === 'rejected') {
      return res.status(400).json({ message: 'Share request already rejected.' })
    }

    shareRequest.status = 'accepted'
    await shareRequest.save()
    const updatedPassword = await Password.findByIdAndUpdate(
      shareRequest.passwordId,
      { $addToSet: { sharedWith: shareRequest.to } },
      { new: true }
    )

    if (!updatedPassword) {
      return res.status(404).json({ message: 'Password not found.' })
    }

    res.json({ message: 'Share request accepted.', updatedPassword })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// CREATE: reject Share Request
router.post('/:id/reject', async (req, res) => {
  try {
    const shareRequestId = req.params.id
    const shareRequest = await ShareRequest.findById(shareRequestId)
    if (!shareRequest) {
      return res.status(404).json({ message: 'Share request not found.' })
    }

    if (shareRequest.status === 'accepted') {
      return res.status(400).json({ message: 'Share request already accepted.' })
    }
    if (shareRequest.status === 'rejected') {
      return res.status(400).json({ message: 'Share request already rejected.' })
    }

    shareRequest.status = 'rejected'
    await shareRequest.save()
    res.json({ message: 'Share request rejected.' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// READ: fetch all share requests for a user(receiver) by status
router.get('/passwords/shared/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query; 

    const query = {
      to: userId,
      status: status,  
    };

    const shareRequests = await ShareRequest.find(query)
      .populate({
        path: 'passwordId',
        populate: {
          path: 'userId',
          select: 'username'
        }
      })
      .populate('from', 'username') 
      .exec();

    if (!shareRequests.length) {
      return res.status(404).json({ message: `No ${status} share requests found for this user.` });
    }

    const response = shareRequests.map(request => {
      const decryptedPassword = decrypt(request.passwordId.password); 
      return {
        id: request._id,
        url: request.passwordId.url,
        owner: request.passwordId.userId.username,
        from: request.from.username,
        password: decryptedPassword,
        status: request.status
      };
    });

    res.json(response);
  } catch (error) {
    console.error('Fetch Share Requests Error:', error);
    res.status(500).json({ error: error.message });
  }
});


module.exports = router
