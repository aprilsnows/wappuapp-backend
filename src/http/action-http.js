import _ from 'lodash';
import * as actionCore from '../core/action-core';
import {createJsonRoute, throwStatus} from '../util/express';
import {assert} from '../validation';
import * as imageHttp from './image-http';
import * as throttleCore from '../core/throttle-core';

let postAction = createJsonRoute(function(req, res) {
  const action = assert(req.body, 'action');
  if (_.isString(action.text) && action.text.trim().length === 0) {
    throwStatus(400, 'Text cannot be empty.');
  }

  if (!throttleCore.canDoAction(action.user, action.type)) {
    throwStatus(429, `Too many actions of type ${ action.type }`);
  } else if (!req.client.id) {
    throwStatus(403);
  }

  let handleAction;
  if (action.type === 'IMAGE') {
    handleAction = imageHttp.postImage(req, res, action);
  } else {
    action.ip = req.ip;
    action.isBanned = req.client.isBanned;

    handleAction = actionCore.getActionType(action.type)
    .then(type => {
      if (type === null) {
        throwStatus(400, 'Action type ' + action.type + ' does not exist');
      }
    })
    .then(() => {
      return actionCore.createAction(action).then(rowsInserted => undefined);
    });
  }

  return handleAction
    .then(() => throttleCore.executeAction(action.user, action.type));
});

export {
  postAction
};
