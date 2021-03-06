const {knex} = require('../util/database').connect();
import _ from 'lodash';
import {deepChangeKeyCase} from '../util';

function getTeams(client) {
  const isBanned = client && !!client.isBanned;

  let sqlString = `
  SELECT teams.id, teams.name, teams.image_path,
    SUM(COALESCE(action_types.value, 0)) AS score
  FROM teams
  LEFT JOIN actions ON teams.id = actions.team_id ${isBanned ? '' : 'AND NOT actions.is_banned'}
  LEFT JOIN action_types ON actions.action_type_id = action_types.id
  GROUP BY teams.id, teams.name
  ORDER BY score DESC, teams.id`;

  return knex.raw(sqlString)
  .then(result => {
    return _.map(result.rows, row => deepChangeKeyCase(row, 'camelCase'));
  });
}

export {
  getTeams
};
