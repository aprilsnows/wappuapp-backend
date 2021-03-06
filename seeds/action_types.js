var util = require('../src/util/seeds');

exports.seed = function(knex, Promise) {
  return util.insertOrUpdate(knex, 'action_types', {
    id: 1,
    code: 'BUTTON_PUSH',
    name: 'Don\'t Press',
    value: 1,
    cooldown: 30 * 1000
  })
  .then(() => {
    return util.insertOrUpdate(knex, 'action_types', {
      id: 2,
      code: 'SIMA',
      name: 'Grab a sima',
      value: 5,
      cooldown: 5 * 60 * 1000
    });
  })
  .then(() => {
    return util.insertOrUpdate(knex, 'action_types', {
      id: 4,
      code: 'LECTURE',
      name: 'At a lecture',
      value: 200,
      cooldown: 45 * 60 * 1000
    });
  })
  .then(() => {
    return util.insertOrUpdate(knex, 'action_types', {
      id: 5,
      code: 'IMAGE',
      name: 'Pics or didn\'t happen',
      value: 100,
      cooldown: 5 * 60 * 1000
    });
  })
  .then(() => {
    return util.insertOrUpdate(knex, 'action_types', {
      id: 6,
      code: 'TEXT',
      name: 'Comment',
      value: 10,
      cooldown: 10 * 1000
    });
  })
  .then(() => {
    return util.insertOrUpdate(knex, 'action_types', {
      id: 7,
      code: 'IMAGE_REWARD',
      name: 'Reward',
      value: 200000,
      cooldown: 1000 * 60 * 1000,
      is_user_action: false
    });
  })
  .then(() => {
    return util.insertOrUpdate(knex, 'action_types', {
      id: 8,
      code: 'IMAGE_REWARD2',
      name: 'Reward 2',
      value: 300000,
      cooldown: 1000 * 60 * 1000,
      is_user_action: false
    });
  });
};
