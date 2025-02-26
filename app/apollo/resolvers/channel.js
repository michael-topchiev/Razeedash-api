/**
 * Copyright 2020 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const _ = require('lodash');
const { v4: UUID } = require('uuid');
const GraphqlFields = require('graphql-fields');
const conf = require('../../conf.js').conf;
const streamToString = require('stream-to-string');
const pLimit = require('p-limit');
const { applyQueryFieldsToChannels, applyQueryFieldsToDeployableVersions } = require('../utils/applyQueryFields');
const storageFactory = require('./../../storage/storageFactory');
const yaml = require('js-yaml');

const { ACTIONS, TYPES, CHANNEL_VERSION_YAML_MAX_SIZE_LIMIT_MB, CHANNEL_LIMITS, CHANNEL_VERSION_LIMITS } = require('../models/const');
const { whoIs, validAuth, getAllowedChannels, filterChannelsToAllowed, NotFoundError, RazeeValidationError, BasicRazeeError, RazeeQueryError} = require ('./common');

const channelResolvers = {
  Query: {
    channels: async(parent, { orgId }, context, fullQuery) => {
      const queryFields = GraphqlFields(fullQuery);
      const { me, req_id, logger } = context;
      const queryName = 'channels';
      logger.debug({req_id, user: whoIs(me), orgId }, `${queryName} enter`);

      try{
        var channels = await getAllowedChannels(me, orgId, ACTIONS.READ, TYPES.CHANNEL, context);
        await applyQueryFieldsToChannels(channels, queryFields, { orgId }, context);
      }catch(err){
        logger.error(err, `${queryName} encountered an error when serving ${req_id}.`);
        throw new NotFoundError(context.req.t('Query {{queryName}} find error. MessageID: {{req_id}}.', {'queryName':queryName, 'req_id':req_id}), context);
      }
      return channels;
    },
    channel: async(parent, { orgId, uuid }, context, fullQuery) => {
      const queryFields = GraphqlFields(fullQuery);
      const { models, me, req_id, logger } = context;
      const queryName = 'channel';
      logger.debug({req_id, user: whoIs(me), orgId, uuid}, `${queryName} enter`);

      try{
        var channel = await models.Channel.findOne({org_id: orgId, uuid });
        if (!channel) {
          throw new NotFoundError(context.req.t('Could not find the configuration channel with uuid {{uuid}}.', {'uuid':uuid}), context);
        }
        await validAuth(me, orgId, ACTIONS.READ, TYPES.CHANNEL, queryName, context, [channel.uuid, channel.name]);
        await applyQueryFieldsToChannels([channel], queryFields, { orgId }, context);
      }catch(err){
        logger.error(err, `${queryName} encountered an error when serving ${req_id}.`);
        throw new RazeeQueryError(context.req.t('Query {{queryName}} error. MessageID: {{req_id}}.', {'queryName':queryName, 'req_id':req_id}), context);
      }
      return channel;
    },
    channelByName: async(parent, { orgId, name }, context, fullQuery) => {
      const queryFields = GraphqlFields(fullQuery);
      const { models, me, req_id, logger } = context;
      const queryName = 'channelByName';
      logger.debug({req_id, user: whoIs(me), orgId, name}, `${queryName} enter`);

      try{
        var channel = await models.Channel.findOne({ org_id: orgId, name });
        if (!channel) {
          throw new NotFoundError(context.req.t('Could not find the configuration channel with name {{name}}.', {'name':name}), context);
        }
        await validAuth(me, orgId, ACTIONS.READ, TYPES.CHANNEL, queryName, context, [channel.uuid, channel.name]);
        await applyQueryFieldsToChannels([channel], queryFields, { orgId }, context);
      }catch(err){
        logger.error(err, `${queryName} encountered an error when serving ${req_id}.`);
        throw new RazeeQueryError(context.req.t('Query {{queryName}} error. MessageID: {{req_id}}.', {'queryName':queryName, 'req_id':req_id}), context);
      }
      return channel;
    },
    channelsByTags: async(parent, { orgId, tags }, context, fullQuery)=>{
      const queryFields = GraphqlFields(fullQuery);
      const { models, me, req_id, logger } = context;
      const queryName = 'channelsByTags';
      logger.debug({req_id, user: whoIs(me), orgId, tags}, `${queryName} enter`);

      try{
        if(tags.length < 1){
          throw new RazeeValidationError('Please supply one or more tags', context);
        }
        var channels = await models.Channel.find({ org_id: orgId, tags: { $all: tags } });
        channels = await filterChannelsToAllowed(me, orgId, ACTIONS.READ, TYPES.CHANNEL, channels, context);
        await applyQueryFieldsToChannels(channels, queryFields, { orgId }, context);

      }catch(err){
        logger.error(err, `${queryName} encountered an error when serving ${req_id}.`);
        throw new RazeeQueryError(context.req.t('Query {{queryName}} error. MessageID: {{req_id}}.', {'queryName':queryName, 'req_id':req_id}), context);
      }
      return channels;
    },
    channelVersionByName: async(parent, { orgId: org_id, channelName, versionName }, context, fullQuery) => {
      const { me, req_id, logger } = context;
      const queryName = 'channelVersionByName';
      logger.debug({req_id, user: whoIs(me), org_id, channelName, versionName }, `${queryName} enter`);
      return await channelResolvers.Query.channelVersion(parent,  {orgId: org_id, channelName, versionName, _queryName: queryName }, context, fullQuery);
    },

    channelVersion: async(parent, { orgId: org_id, channelUuid, versionUuid, channelName, versionName, _queryName }, context, fullQuery) => {
      const queryFields = GraphqlFields(fullQuery);
      const { models, me, req_id, logger } = context;
      const queryName = _queryName ? `${_queryName}/channelVersion` : 'channelVersion';
      logger.debug({req_id, user: whoIs(me), org_id, channelUuid, versionUuid, channelName, versionName}, `${queryName} enter`);

      try{

        const org = await models.Organization.findOne({ _id: org_id });
        if (!org) {
          throw new NotFoundError(context.req.t('Could not find the organization with ID {{org_id}}.', {'org_id':org_id}), context);
        }
        const orgKey = _.first(org.orgKeys);

        // search channel by channel uuid or channel name
        const channelFilter = channelName ? { name: channelName, org_id } : { uuid: channelUuid, org_id } ;
        const channel = await models.Channel.findOne(channelFilter);
        if(!channel){
          throw new NotFoundError(context.req.t('Could not find the configuration channel with uuid/name {{channelUuid}}/channelName.', {'channelUuid':channelUuid}), context);
        }
        await validAuth(me, org_id, ACTIONS.READ, TYPES.CHANNEL, queryName, context, [channel.uuid, channel.name]);
        const channel_uuid = channel.uuid; // in case query by channelName, populate channel_uuid

        // search version by version uuid or version name
        const versionObj = channel.versions.find(v => (v.uuid === versionUuid || v.name === versionName));
        if (!versionObj) {
          throw new NotFoundError(context.req.t('versionObj "{{versionUuid}}" is not found for {{channel.name}}:{{channel.uuid}}', {'versionUuid':versionUuid, 'channel.name':channel.name, 'channel.uuid':channel.uuid}), context);
        }
        const version_uuid = versionObj.uuid; // in case query by versionName, populate version_uuid
        const deployableVersionObj = await models.DeployableVersion.findOne({org_id, channel_id: channel_uuid, uuid: version_uuid });
        if (!deployableVersionObj) {
          throw new NotFoundError(context.req.t('DeployableVersion is not found for {{channel.name}}:{{channel.uuid}}/{{versionObj.name}}:{{versionObj.uuid}}.', {'channel.name':channel.name, 'channel.uuid':channel.uuid, 'versionObj.name':versionObj.name, 'versionObj.uuid':versionObj.uuid}), context);
        }
        await applyQueryFieldsToDeployableVersions([ deployableVersionObj ], queryFields, { orgId: org_id }, context);

        const handler = storageFactory(logger).deserialize(deployableVersionObj.content);
        deployableVersionObj.content = await handler.getDataAndDecrypt(orgKey, deployableVersionObj.iv);

        return deployableVersionObj;
      }catch(err){
        logger.error(err, `${queryName} encountered an error when serving ${req_id}.`);
        throw new RazeeQueryError(context.req.t('Query {{queryName}} error. MessageID: {{req_id}}.', {'queryName':queryName, 'req_id':req_id}), context);
      }
    }
  },
  Mutation: {
    addChannel: async (parent, { orgId: org_id, name, data_location, tags=[] }, context)=>{
      const { models, me, req_id, logger } = context;
      const queryName = 'addChannel';
      logger.debug({ req_id, user: whoIs(me), org_id, name }, `${queryName} enter`);
      await validAuth(me, org_id, ACTIONS.CREATE, TYPES.CHANNEL, queryName, context);

      try {
        // if there is a list of valid data locations, validate the data_location (if provided) is in the list
        if( Array.from(conf.storage.s3ConnectionMap.keys()).length > 0 ) {
          if( data_location && !conf.storage.s3ConnectionMap.has( data_location.toLowerCase() ) ) {
            throw new RazeeValidationError(context.req.t('The data location {{data_location}} is not valid.  Allowed values: [{{valid_locations}}]', {'data_location':data_location, 'valid_locations':Array.from(conf.storage.s3ConnectionMap.keys()).join(' ')}), context);
          }
        }

        // might not necessary with uunique index. Worth to check to return error better.
        const channel = await models.Channel.findOne({ name, org_id });
        if(channel){
          throw new RazeeValidationError(context.req.t('The configuration channel name {{name}} already exists.', {'name':name}), context);
        }

        // validate the number of total channels are under the limit
        const total = await models.Channel.count({org_id});
        if (total >= CHANNEL_LIMITS.MAX_TOTAL ) {
          throw new RazeeValidationError(context.req.t('Too many configuration channels are registered under {{org_id}}.', {'org_id':org_id}), context);
        }

        const uuid = UUID();
        const kubeOwnerId = await models.User.getKubeOwnerId(context);
        await models.Channel.create({
          _id: UUID(),
          uuid, org_id, name, versions: [],
          tags,
          data_location: data_location ? data_location.toLowerCase() : conf.storage.defaultLocation,
          ownerId: me._id,
          kubeOwnerId,
        });
        return {
          uuid,
        };
      } catch(err){
        if (err instanceof BasicRazeeError) {
          throw err;
        }
        logger.error(err, `${queryName} encountered an error when serving ${req_id}.`);
        throw new RazeeQueryError(context.req.t('Query {{queryName}} error. MessageID: {{req_id}}.', {'queryName':queryName, 'req_id':req_id}), context);
      }
    },
    editChannel: async (parent, { orgId: org_id, uuid, name, data_location, tags=[] }, context)=>{
      const { models, me, req_id, logger } = context;
      const queryName = 'editChannel';
      logger.debug({ req_id, user: whoIs(me), org_id, uuid, name }, `${queryName} enter`);

      try{
        const channel = await models.Channel.findOne({ uuid, org_id });
        if(!channel){
          throw new NotFoundError(context.req.t('channel uuid "{{uuid}}" not found', {'uuid':uuid}), context);
        }
        await validAuth(me, org_id, ACTIONS.UPDATE, TYPES.CHANNEL, queryName, context, [channel.uuid, channel.name]);
        await models.Channel.updateOne({ org_id, uuid }, { $set: { name, tags, data_location } }, {omitUndefined:true});

        // find any subscriptions for this configuration channel and update channelName in those subs
        await models.Subscription.updateMany(
          { org_id: org_id, channel_uuid: uuid },
          { $set: { channelName: name } }
        );
        //update the channelName
        await models.DeployableVersion.updateMany(
          { org_id: org_id, channel_id: uuid },
          { $set: { channel_name: name } }

        );

        return {
          uuid,
          success: true,
          name,
          tags,
        };
      } catch(err){
        if (err instanceof BasicRazeeError) {
          throw err;
        }
        logger.error(err, `${queryName} encountered an error when serving ${req_id}.`);
        throw new RazeeQueryError(context.req.t('Query {{queryName}} error. MessageID: {{req_id}}.', {'queryName':queryName, 'req_id':req_id}), context);
      }
    },
    addChannelVersion: async(parent, { orgId: org_id, channelUuid: channel_uuid, name, type, content, file, description }, context)=>{
      const { models, me, req_id, logger } = context;

      const queryName = 'addChannelVersion';
      logger.debug({req_id, user: whoIs(me), org_id, channel_uuid, name, type, description, file }, `${queryName} enter`);

      // slightly modified code from /app/routes/v1/channelsStream.js. changed to use mongoose and graphql
      const org = await models.Organization.findOne({ _id: org_id });
      if (!org) {
        throw new NotFoundError(context.req.t('Could not find the organization with ID {{org_id}}.', {'org_id':org_id}), context);
      }
      const orgKey = _.first(org.orgKeys);

      if(!name){
        throw new RazeeValidationError(context.req.t('A "name" must be specified'), context);
      }
      if(!type || type !== 'yaml' && type !== 'application/yaml'){
        throw new RazeeValidationError(context.req.t('A "type" of application/yaml must be specified'), context);
      }
      if(!channel_uuid){
        throw new RazeeValidationError(context.req.t('A "channel_uuid" must be specified'), context);
      }
      if(!file && !content){
        throw new RazeeValidationError(context.req.t('A "file" or "content" must be specified'), context);
      }

      const channel = await models.Channel.findOne({ uuid: channel_uuid, org_id });
      if(!channel){
        throw new NotFoundError(context.req.t('channel uuid "{{channel_uuid}}" not found', {'channel_uuid':channel_uuid}), context);
      }

      await validAuth(me, org_id, ACTIONS.MANAGEVERSION, TYPES.CHANNEL, queryName, context, [channel.uuid, channel.name]);

      const versions = await models.DeployableVersion.find({ org_id, channel_id: channel_uuid });
      const versionNameExists = !!versions.find((version)=>{
        return (version.name == name);
      });

      if(versionNameExists) {
        throw new RazeeValidationError(context.req.t('The version name {{name}} already exists', {'name':name}), context);
      }
      // validate the number of total configuration channel versions are under the limit
      const total = await models.DeployableVersion.count({org_id, channel_id: channel_uuid});
      if (total >= CHANNEL_VERSION_LIMITS.MAX_TOTAL ) {
        throw new RazeeValidationError(context.req.t('Too many configuration channel versions are registered under {{channel_uuid}}.', {'channel_uuid':channel_uuid}), context);
      }

      try {
        if(file){
          var tempFileStream = (await file).createReadStream();
          content = await streamToString(tempFileStream);
        }
        let yamlSize = Buffer.byteLength(content);
        if(yamlSize > CHANNEL_VERSION_YAML_MAX_SIZE_LIMIT_MB * 1024 * 1024){
          throw new RazeeValidationError(context.req.t('YAML file size should not be more than {{CHANNEL_VERSION_YAML_MAX_SIZE_LIMIT_MB}}mb', {'CHANNEL_VERSION_YAML_MAX_SIZE_LIMIT_MB':CHANNEL_VERSION_YAML_MAX_SIZE_LIMIT_MB}), context);
        }

        yaml.safeLoadAll(content);
      } catch (error) {
        if (error instanceof BasicRazeeError) {
          throw error;
        }
        throw new RazeeValidationError(context.req.t('Provided YAML content is not valid: {{error}}', {'error':error}), context);
      }

      const path = `${org_id.toLowerCase()}-${channel.uuid}-${name}`;
      const bucketName = conf.storage.getChannelBucket(channel.data_location);
      const handler = storageFactory(logger).newResourceHandler(path, bucketName, channel.data_location);
      const ivText = await handler.setDataAndEncrypt(content, orgKey);
      const data = handler.serialize();

      const kubeOwnerId = await models.User.getKubeOwnerId(context);
      const deployableVersionObj = {
        _id: UUID(),
        org_id,
        uuid: UUID(),
        channel_id: channel.uuid,
        channelName: channel.name,
        name,
        description,
        content: data,
        iv: ivText,
        type,
        ownerId: me._id,
        kubeOwnerId,
      };

      const dObj = await models.DeployableVersion.create(deployableVersionObj);
      const versionObj = {
        uuid: deployableVersionObj.uuid,
        name, description,
        created: dObj.created
      };

      await models.Channel.updateOne(
        { org_id, uuid: channel.uuid },
        { $push: { versions: versionObj } }
      );
      return {
        success: true,
        versionUuid: versionObj.uuid,
      };
    },
    removeChannel: async (parent, { orgId: org_id, uuid }, context)=>{
      const { models, me, req_id, logger } = context;
      const queryName = 'removeChannel';
      logger.debug({ req_id, user: whoIs(me), org_id, uuid }, `${queryName} enter`);

      try{
        const channel = await models.Channel.findOne({ uuid, org_id });
        if(!channel){
          throw new NotFoundError(context.req.t('channel uuid "{{uuid}}" not found', {'uuid':uuid}), context);
        }
        await validAuth(me, org_id, ACTIONS.DELETE, TYPES.CHANNEL, queryName, context, [channel.uuid, channel.name]);
        const channel_uuid = channel.uuid;

        const subCount = await models.Subscription.count({ org_id, channel_uuid });
        if(subCount > 0){
          throw new RazeeValidationError(context.req.t('{{subCount}} subscription(s) depend on this configuration channel. Please update/remove them before removing this configuration channel.', {'subCount':subCount}), context);
        }

        const serSubCount = await models.ServiceSubscription.count({ channel_uuid });
        if(serSubCount > 0){
          throw new RazeeValidationError(context.req.t('{{serSubCount}} service subscription(s) depend on this channel. Please have tem updated/removed before removing this channel.', {'serSubCount':serSubCount}), context);
        }

        // deletes the linked deployableVersions in s3
        var versionsToDeleteFromS3 = await models.DeployableVersion.find({ org_id, channel_id: channel.uuid });
        const limit = pLimit(5);
        await Promise.all(_.map(versionsToDeleteFromS3, deployableVersionObj => {
          return limit(async () => {
            const handler = storageFactory(logger).deserialize(deployableVersionObj.content);
            await handler.deleteData();
          });
        }));

        // deletes the linked deployableVersions in db
        await models.DeployableVersion.deleteMany({ org_id, channel_id: channel.uuid });

        // deletes the configuration channel
        await models.Channel.deleteOne({ org_id, uuid });

        return {
          uuid,
          success: true,
        };
      } catch(err){
        if (err instanceof BasicRazeeError) {
          throw err;
        }
        logger.error(err, `${queryName} encountered an error when serving ${req_id}.`);
        throw new RazeeQueryError(context.req.t('Query {{queryName}} error. MessageID: {{req_id}}.', {'queryName':queryName, 'req_id':req_id}), context);
      }
    },
    removeChannelVersion: async (parent, { orgId: org_id, uuid }, context)=>{
      const { models, me, req_id, logger } = context;
      const queryName = 'removeChannelVersion';
      logger.debug({ req_id, user: whoIs(me), org_id, uuid }, `${queryName} enter`);
      try{
        const deployableVersionObj = await models.DeployableVersion.findOne({ org_id, uuid });
        if(!deployableVersionObj){
          throw new NotFoundError(context.req.t('version uuid "{{uuid}}" not found', {'uuid':uuid}), context);
        }

        const subCount = await models.Subscription.count({ org_id, version_uuid: uuid });
        if(subCount > 0){
          throw new RazeeValidationError(context.req.t('{{subCount}} subscriptions depend on this configuration channel version. Please update/remove them before removing this configuration channel version.', {'subCount':subCount}), context);
        }
        const serSubCount = await models.ServiceSubscription.count({ version_uuid: uuid });
        if(serSubCount > 0){
          throw new RazeeValidationError(context.req.t('{{serSubCount}} service subscriptions depend on this channel version. Please have them updated/removed before removing this channel version.', {'serSubCount':serSubCount}), context);
        }

        const channel_uuid = deployableVersionObj.channel_id;
        const channel = await models.Channel.findOne({ uuid: channel_uuid, org_id });
        if(!channel){
          throw new NotFoundError(context.req.t('channel uuid "{{channel_uuid}}" not found', {'channel_uuid':channel_uuid}), context);
        }
        await validAuth(me, org_id, ACTIONS.MANAGEVERSION, TYPES.CHANNEL, queryName, context, [channel.uuid, channel.name]);
        const versionObj = channel.versions.find(v => v.uuid === uuid);
        if (!versionObj) {
          throw new NotFoundError(context.req.t('versionObj "{{uuid}}" is not found for {{channel.name}}:{{channel.uuid}}', {'uuid':uuid, 'channel.name':channel.name}), context);
        }

        const handler = storageFactory(logger).deserialize(deployableVersionObj.content);
        await handler.deleteData();

        await models.DeployableVersion.deleteOne({ org_id, uuid });

        const versionObjs = channel.versions;
        const vIndex = versionObjs.findIndex(v => v.uuid === uuid);
        versionObjs.splice(vIndex, 1);
        await models.Channel.updateOne(
          { org_id, uuid: channel_uuid },
          { versions: versionObjs }
        );
        return {
          uuid,
          success: true,
        };
      } catch(err){
        if (err instanceof BasicRazeeError) {
          throw err;
        }
        logger.error(err, `${queryName} encountered an error when serving ${req_id}.`);
        throw new RazeeQueryError(context.req.t('Query {{queryName}} error. MessageID: {{req_id}}.', {'queryName':queryName, 'req_id':req_id}), context);
      }
    },
  },
};

module.exports = channelResolvers;
