const express = require('express');
const feedService = require('../services/feedService');
const prisma = require('../db');
const cache = require('../lib/cache');
const { createRateLimiter } = require('../lib/rateLimiter');

const router = express.Router();

const postCreationLimiter = createRateLimiter({
  action: 'feed:create_post',
  windowMs: 60000,
  max: 10,
  message: 'You are posting too quickly. Please wait a minute before sharing another post.',
  keyGenerator: (req) => req.body?.authorId || req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip
});

// Get active announcements (cached for 60s)
router.get('/announcements', async (req, res) => {
  try {
    const announcements = await cache.wrap('feed:announcements', async () => {
      const now = new Date();
      return prisma.announcement.findMany({
        where: {
          OR: [
            { expiryDate: null },
            { expiryDate: { gte: now } }
          ]
        },
        orderBy: { createdAt: 'desc' }
      });
    }, 60);

    res.json(announcements);
  } catch (err) {
    console.error('Error fetching announcements:', err);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// Get available tags (cached for 300s)
router.get('/tags', async (req, res) => {
  try {
    const tags = await cache.wrap('feed:tags', () => feedService.getAvailableTags(), 300);
    res.json(tags);
  } catch (err) {
    res.json(feedService.getAvailableTags());
  }
});

// Get saved posts for a user
router.get('/saved/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const result = await feedService.getSavedPosts(userId, { page, limit });
    res.json(result);
  } catch (err) {
    console.error('Error fetching saved posts:', err);
    res.status(500).json({ error: 'Failed to fetch saved posts' });
  }
});

// Get user feed stats
router.get('/user/:userId/stats', async (req, res) => {
  try {
    const stats = await feedService.getUserFeedStats(req.params.userId);
    res.json(stats);
  } catch (err) {
    console.error('Error fetching user feed stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get feed posts (query: tab, cursor, page, limit, tag, userId)
router.get('/', async (req, res) => {
  try {
    const tab = req.query.tab || 'latest';
    const cursor = req.query.cursor || undefined;
    const page = req.query.page ? parseInt(req.query.page) : undefined;
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);
    const tag = req.query.tag || undefined;
    const userId = req.query.userId || undefined;
    const result = await feedService.getPosts({ tab, cursor, page, limit, tag, userId });
    res.json(result);
  } catch (err) {
    console.error('Error fetching feed:', err);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

// Create a post (with rate limiting)
router.post('/', postCreationLimiter, async (req, res) => {
  try {
    const { authorId, content, imageUrl, isAnonymous, tags } = req.body;
    if (!authorId) return res.status(400).json({ error: 'authorId is required' });
    if (!content && !imageUrl) return res.status(400).json({ error: 'Content or image is required' });

    let moderationData = {
      moderationStatus: imageUrl ? 'PENDING_MODERATION' : 'SAFE',
      moderationProvider: 'Sightengine',
      nudityScore: null,
      goreScore: null,
      rawModerationResponse: null,
      moderatedAt: imageUrl ? null : new Date()
    };

    if (imageUrl) {
      const sightengineService = require('../services/sightengineService');
      const scan = await sightengineService.moderateImage(imageUrl);
      
      if (scan.status === 'REJECTED') {
        // EXPLICIT -> Reject upload
        // We could also delete from Cloudinary here if we had the publicId extraction, 
        // but for now we just reject.
        return res.status(400).json({ error: 'This image violates our community guidelines (Explicit Content).' });
      }

      moderationData = {
        moderationStatus: scan.status,
        moderationProvider: 'Sightengine',
        nudityScore: scan.nudityScore,
        goreScore: scan.goreScore,
        rawModerationResponse: scan.rawModerationResponse,
        moderatedAt: new Date()
      };
    }

    const post = await feedService.createPost(authorId, {
      content,
      imageUrl,
      isAnonymous,
      tags,
      ...moderationData
    });

    res.status(201).json(post);
  } catch (err) {
    console.error('Error creating post:', err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Get a single post
router.get('/:postId', async (req, res) => {
  try {
    const userId = req.query.userId || undefined;
    const post = await feedService.getPostById(req.params.postId, userId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
  } catch (err) {
    console.error('Error fetching post:', err);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// Update a post
router.put('/:postId', async (req, res) => {
  try {
    const { authorId, content, imageUrl, tags } = req.body;
    if (!authorId) return res.status(400).json({ error: 'authorId is required' });
    const post = await feedService.updatePost(req.params.postId, authorId, { content, imageUrl, tags });
    res.json(post);
  } catch (err) {
    if (err.message === 'Unauthorized') return res.status(403).json({ error: 'Unauthorized' });
    console.error('Error updating post:', err);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// Delete a post
router.delete('/:postId', async (req, res) => {
  try {
    const { authorId } = req.body;
    if (!authorId) return res.status(400).json({ error: 'authorId is required' });
    await feedService.deletePost(req.params.postId, authorId);
    res.json({ success: true });
  } catch (err) {
    if (err.message === 'Unauthorized') return res.status(403).json({ error: 'Unauthorized' });
    console.error('Error deleting post:', err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Vote on a post
router.post('/:postId/vote', async (req, res) => {
  try {
    const { userId, value } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (value !== 1 && value !== -1) return res.status(400).json({ error: 'value must be 1 or -1' });
    const result = await feedService.vote(userId, req.params.postId, value);
    res.json(result);
  } catch (err) {
    console.error('Error voting:', err);
    res.status(500).json({ error: 'Failed to vote' });
  }
});

// Save/bookmark a post
router.post('/:postId/save', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    await feedService.savePost(userId, req.params.postId);
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving post:', err);
    res.status(500).json({ error: 'Failed to save post' });
  }
});

// Unsave a post
router.delete('/:postId/save', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    await feedService.unsavePost(userId, req.params.postId);
    res.json({ success: true });
  } catch (err) {
    console.error('Error unsaving post:', err);
    res.status(500).json({ error: 'Failed to unsave post' });
  }
});

// Get comments for a post
router.get('/:postId/comments', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const comments = await feedService.getComments(req.params.postId, { page, limit });
    res.json(comments);
  } catch (err) {
    console.error('Error fetching comments:', err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Create a comment
router.post('/:postId/comments', async (req, res) => {
  try {
    const { authorId, content, parentId, isAnonymous } = req.body;
    if (!authorId || !content) return res.status(400).json({ error: 'authorId and content are required' });
    const comment = await feedService.createComment(authorId, req.params.postId, { content, parentId, isAnonymous });
    res.status(201).json(comment);
  } catch (err) {
    if (err.message === 'Comments are locked') return res.status(403).json({ error: err.message });
    console.error('Error creating comment:', err);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// Delete a comment
router.delete('/comments/:commentId', async (req, res) => {
  try {
    const { authorId } = req.body;
    if (!authorId) return res.status(400).json({ error: 'authorId is required' });
    await feedService.deleteComment(req.params.commentId, authorId);
    res.json({ success: true });
  } catch (err) {
    if (err.message === 'Unauthorized') return res.status(403).json({ error: 'Unauthorized' });
    console.error('Error deleting comment:', err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

module.exports = router;
