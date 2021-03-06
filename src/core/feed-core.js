import _ from 'lodash';
const {knex} = require('../util/database').connect();
import {GCS_CONFIG} from '../util/gcs';
import CONST from '../constants';
const logger = require('../util/logger')(__filename);

const FEED_ITEM_TYPES = new Set(['IMAGE', 'TEXT', 'CHECK_IN']);

function getStickySqlString() {
  return `
    (SELECT
      feed_items.id as id,
      feed_items.location as location,
      feed_items.created_at as created_at,
      feed_items.image_path as image_path,
      feed_items.text as text,
      feed_items.type as action_type_code,
      COALESCE(users.name, 'SYSTEM') as user_name,
      users.uuid as user_uuid,
      teams.name as team_name,
      vote_score(feed_items) as votes,
      feed_items.hot_score as hot_score,
      feed_items.is_sticky
    FROM feed_items
    LEFT JOIN users ON users.id = feed_items.user_id
    LEFT JOIN teams ON teams.id = users.team_id
    WHERE feed_items.is_sticky
    GROUP BY feed_items.id, users.name, users.uuid, teams.name
    ORDER BY feed_items.id DESC
    LIMIT 2)`;
}

function getFeed(opts) {
  opts = _.merge({
    limit: 20
  }, opts);

  let sqlString = `
    (SELECT
      feed_items.id as id,
      feed_items.location as location,
      feed_items.created_at as created_at,
      feed_items.image_path as image_path,
      feed_items.text as text,
      feed_items.type as action_type_code,
      COALESCE(users.name, 'SYSTEM') as user_name,
      users.uuid as user_uuid,
      teams.name as team_name,
      vote_score(feed_items) as votes,
      feed_items.hot_score as hot_score,
      feed_items.is_sticky
    FROM feed_items
    LEFT JOIN users ON users.id = feed_items.user_id
    LEFT JOIN teams ON teams.id = users.team_id`;

  let params = [];
  let whereClauses = ['NOT feed_items.is_sticky'];

  if (!opts.beforeId) {
    sqlString = getStickySqlString() + " UNION ALL " + sqlString;
  } else {
    whereClauses.push('feed_items.id < ?');
    params.push(opts.beforeId);
  }

  if (!opts.client.isBanned) {
    whereClauses.push('NOT feed_items.is_banned');
  }

  if (whereClauses.length > 0) {
    sqlString += ` WHERE ${ whereClauses.join(' AND ')}`;
  }

  sqlString += ` ) `;
  sqlString += _getSortingSql(opts.sort);
  sqlString += ` LIMIT ?`;
  params.push(opts.limit);

  return knex.raw(sqlString, params)
  .then(result => {
    const rows = result.rows;

    if (_.isEmpty(rows)) {
      return [];
    }

    return _.map(rows, row => _actionToFeedObject(row, opts.client));
  });
}

function createFeedItem(feedItem, trx) {
  if (!FEED_ITEM_TYPES.has(feedItem.type)) {
    throw new Error('Invalid feed item type ' + feedItem.type);
  }

  const dbRow = {
    'image_path': feedItem.imagePath,
    'text':       feedItem.text,
    'type':       feedItem.type
  };

  const location = feedItem.location;
  if (location) {
    // Tuple is in longitude, latitude format in Postgis
    dbRow.location = location.longitude + ',' + location.latitude;
  }
  if (feedItem.isBanned) {
    dbRow.is_banned = feedItem.isBanned;
  }

  if (feedItem.isSticky) {
    dbRow.is_sticky = feedItem.isSticky;
  }

  // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
  if (feedItem.user) {
    dbRow.user_id = knex.raw('(SELECT id from users WHERE uuid = ?)', [feedItem.user]);
  }

  trx = trx || knex;

  return trx.returning('id').insert(dbRow).into('feed_items')
    .then(rows => {
      if (_.isEmpty(rows)) {
        throw new Error('Feed item row creation failed: ' + dbRow);
      }

      return rows.length;
    });
}

function deleteFeedItem(id, opts) {
  opts = opts || {};

  return knex('feed_items').delete().where({
    'id': id,
    'user_id': knex.raw('(SELECT id from users WHERE uuid = ?)', [opts.client.uuid])
  })
  .then(deletedCount => {
    if (deletedCount > 1) {
      logger.error('Deleted feed item', id, 'client uuid:', opts.client.uuid);
      throw new Error('Unexpected amount of deletes happened: ' + deletedCount)
    }

    return deletedCount;
  });
}

function _actionToFeedObject(row, client) {
  if (!client) {
    throw new Error('Client information not passed as a parameter');
  }

  var feedObj = {
    id: row['id'],
    type: row['action_type_code'],
    votes: row['votes'],
    hotScore: row['hot_score'],
    author: {
      name: row['user_name'],
      team: row['team_name'],
      type: _resolveAuthorType(row, client)
    },
    createdAt: row['created_at']
  };

  if (row.location) {
    feedObj.location = {
      latitude: row.location.y,
      longitude: row.location.x
    };
  }

  if (feedObj.type === 'IMAGE') {
    const imagePath = row['image_path'];

    if (process.env.DISABLE_IMGIX === 'true' || _.endsWith(imagePath, 'gif')) {
      feedObj.url = GCS_CONFIG.baseUrl + '/' + GCS_CONFIG.bucketName + '/' + imagePath;
    } else {
      feedObj.url =
        'https://' + GCS_CONFIG.bucketName + '.imgix.net/' + imagePath +
        process.env.IMGIX_QUERY;
    }
  } else if (feedObj.type === 'TEXT') {
    feedObj.text = row.text;
  }

  return feedObj;
}

function _getSortingSql(sort) {
  const {
    NEW,
    HOT,
  } = CONST.FEED_SORT_TYPES;

  if (sort === NEW) {
    return 'ORDER BY is_sticky DESC, id DESC'
  } else if (sort === HOT) {
    return 'ORDER BY is_sticky DESC, hot_score DESC, id DESC'
  } else {
    return '';
  }
}

function _resolveAuthorType(row, client) {
  const rowUserUuid = row['user_uuid'];

  if (rowUserUuid === null) {
    return CONST.AUTHOR_TYPES.SYSTEM;
  } else if (rowUserUuid === client.uuid) {
    return CONST.AUTHOR_TYPES.ME;
  }

  return CONST.AUTHOR_TYPES.OTHER_USER;
}

export {
  getFeed,
  createFeedItem,
  deleteFeedItem,
};
