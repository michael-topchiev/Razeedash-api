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

const { expect } = require('chai');
const fs = require('fs');
const { v4: UUID } = require('uuid');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { models } = require('../models');
const resourceFunc = require('./api');
const subscriptionFunc = require('./subscriptionsApi');

const apollo = require('../index');
const { AUTH_MODEL } = require('../models/const');
const { prepareUser, prepareOrganization, signInUser } = require(`./testHelper.${AUTH_MODEL}`);
const { GraphqlPubSub } = require('../subscription');

//const why = require('why-is-node-running');


let mongoServer;
let myApollo;

const graphqlPort = 18006;
const graphqlUrl = `http://localhost:${graphqlPort}/graphql`;
const resourceApi = resourceFunc(graphqlUrl);
const subscriptionApi = subscriptionFunc(graphqlUrl);
let token;
let adminToken;

let org01Data;
let org77Data;
let org01;
let org77;

let user01Data;
let user01;
let user77Data;
let userRootData;

let presetOrgs;
let presetUsers;
let presetClusters;

const channel_01_name = 'fake_channel_01';
const channel_01_uuid = 'fake_ch_01_uuid';

const channel_02_name = 'fake_channel_02';
const channel_02_uuid = 'fake_ch_02_uuid';

const channel_03_name = 'fake_channel_03';
const channel_03_uuid = 'fake_ch_03_uuid';

const channelVersion_01_name = 'fake_channelVersion_01';
const channelVersion_01_uuid = 'fake_cv_01_uuid';

const channelVersion_02_name = 'fake_channelVersion_02';
const channelVersion_02_uuid = 'fake_cv_02_uuid';

const channelVersion_03_name = 'fake_channelVersion_03';
const channelVersion_03_uuid = 'fake_cv_03_uuid';

const subscription_01_name = 'fake_subscription_01';
const subscription_01_uuid = 'fake_sub_01_uuid';

const subscription_02_name = 'fake_subscription_02';
const subscription_02_uuid = 'fake_sub_02_uuid';

const subscription_03_name = 'fake_subscription_03';
const subscription_03_uuid = 'fake_sub_03_uuid';

const createOrganizations = async () => {
  org01Data = JSON.parse(
    fs.readFileSync(
      `./app/apollo/test/data/${AUTH_MODEL}/cluster.spec.org_01.json`,
      'utf8',
    ),
  );
  org01 = await prepareOrganization(models, org01Data);
  org77Data = JSON.parse(
    fs.readFileSync(
      `./app/apollo/test/data/${AUTH_MODEL}/cluster.spec.org_77.json`,
      'utf8',
    ),
  );
  org77 = await prepareOrganization(models, org77Data);
};

const createUsers = async () => {
  user01Data = JSON.parse(
    fs.readFileSync(
      `./app/apollo/test/data/${AUTH_MODEL}/cluster.spec.user01.json`,
      'utf8',
    ),
  );
  user01 = await prepareUser(models, user01Data);
  user77Data = JSON.parse(
    fs.readFileSync(
      `./app/apollo/test/data/${AUTH_MODEL}/cluster.spec.user77.json`,
      'utf8',
    ),
  );
  await prepareUser(models, user77Data);
  userRootData = JSON.parse(
    fs.readFileSync(
      `./app/apollo/test/data/${AUTH_MODEL}/cluster.spec.root.json`,
      'utf8',
    ),
  );
  await prepareUser(models, userRootData);
  return {};
};

// eslint-disable-next-line no-unused-vars
const getPresetOrgs = async () => {
  presetOrgs = await models.Organization.find();
  presetOrgs = presetOrgs.map(user => {
    return user.toJSON();
  });
  console.log(`presetOrgs=${JSON.stringify(presetOrgs)}`);
};

// eslint-disable-next-line no-unused-vars
const getPresetUsers = async () => {
  presetUsers = await models.User.find();
  presetUsers = presetUsers.map(user => {
    return user.toJSON();
  });
  console.log(`presetUsers=${JSON.stringify(presetUsers)}`);
};

// eslint-disable-next-line no-unused-vars
const getPresetClusters = async () => {
  presetClusters = await models.Cluster.find();
  presetClusters = presetClusters.map(cluster => {
    return cluster.toJSON();
  });
  console.log(`presetClusters=${JSON.stringify(presetClusters)}`);
};

const createChannels = async () => {
  await models.Channel.create({
    _id: 'fake_ch_id_1',
    org_id: org01._id,
    uuid: channel_01_uuid,
    name: channel_01_name,
    versions: [
      {
        uuid: channelVersion_01_uuid,
        name: channelVersion_01_name
      },
      {
        uuid: channelVersion_02_uuid,
        name: channelVersion_02_name
      }
    ]
  });

  await models.Channel.create({
    _id: 'fake_id_2',
    org_id: org01._id,
    uuid: channel_02_uuid,
    name: channel_02_name,
    versions: [
      {
        uuid: channelVersion_03_uuid,
        name: channelVersion_03_name
      }
    ]
  });

  await models.Channel.create({
    _id: 'fake_id_3',
    org_id: org77._id,
    uuid: channel_03_uuid,
    name: channel_03_name,
    versions: []
  });
};

const createGroups = async () => {
  await models.Group.create({
    _id: UUID(),
    org_id: org01._id,
    uuid: UUID(),
    name: 'dev',
    owner: user01._id,
  });
  await models.Group.create({
    _id: UUID(),
    org_id: org01._id,
    uuid: UUID(),
    name: 'stage',
    owner: user01._id,
  });
  await models.Group.create({
    _id: UUID(),
    org_id: org77._id,
    uuid: UUID(),
    name: 'dev',
    owner: user01._id,
  });
};

const createSubscriptions = async () => {
  await models.Subscription.create({
    _id: 'fake_id_1',
    org_id: org01._id,
    uuid: subscription_01_uuid,
    name: subscription_01_name,
    owner: user01._id,
    groups: ['dev'],
    channel_uuid: channel_01_uuid,
    channel: channel_01_name,
    version: channelVersion_01_name,
    version_uuid: channelVersion_01_uuid,
  });

  await models.Subscription.create({
    _id: 'fake_id_2',
    org_id: org01._id,
    uuid: subscription_02_uuid,
    name: subscription_02_name,
    owner: user01._id,
    groups: ['dev'],
    channel_uuid: channel_01_uuid,
    channel: channel_01_name,
    version: channelVersion_02_name,
    version_uuid: channelVersion_02_uuid,
  });

  await models.Subscription.create({
    _id: 'fake_id_3',
    org_id: org77._id,
    uuid: subscription_03_uuid,
    name: subscription_03_name,
    owner: user01._id,
    groups: ['dev'],
    channel_uuid: channel_02_uuid,
    channel: channel_02_name,
    version: channelVersion_03_name,
    version_uuid: channelVersion_03_uuid,
  });
};

const createClusters = async () => {
  await models.Cluster.create({
    org_id: org01._id,
    cluster_id: 'cluster_01',
    metadata: {
      kube_version: {
        major: '1',
        minor: '16',
        gitVersion: '1.99',
        gitCommit: 'abc',
        gitTreeState: 'def',
        buildDate: 'a_date',
        goVersion: '1.88',
        compiler: 'some compiler',
        platform: 'linux/amd64',
      },
    },
    registration: { name: 'my-cluster1' }
  });
};

const groupClusters = async () => {
  await models.Cluster.updateMany({
    org_id: org01._id,
    cluster_id: {$in: 'cluster_01'}
  },
  {$push: {
    groups: {
      uuid: 'uuid',
      name: 'dev'
    },
  }});
};

describe('subscription graphql test suite', () => {
  before(async () => {
    process.env.NODE_ENV = 'test';
    mongoServer = new MongoMemoryServer();
    const mongoUrl = await mongoServer.getConnectionString();
    console.log(`    cluster.js in memory test mongodb url is ${mongoUrl}`);

    myApollo = await apollo({
      mongo_url: mongoUrl,
      graphql_port: graphqlPort,
    });

    await createOrganizations();
    await createUsers();
    await createGroups();
    await createChannels();
    await createSubscriptions();
    await createClusters();
    await groupClusters();
    // Can be uncommented if you want to see the test data that was added to the DB
    // await getPresetOrgs();
    // await getPresetUsers();
    // await getPresetClusters();

    token = await signInUser(models, resourceApi, user01Data);
    adminToken = await signInUser(models, resourceApi, userRootData);
  }); // before

  after(async () => {
    await myApollo.stop(myApollo);
    GraphqlPubSub.deleteInstance();
    await mongoServer.stop();
    // setTimeout(function() {
    //  why(); // logs out active handles that are keeping node running
    // }, 5000);
  }); // after

  it('get subscriptions', async () => {
    try {
      const result = await subscriptionApi.subscriptions(token, {
        orgId: org01._id,
      });
      const {
        data: {
          data: { subscriptions },
        },
      } = result;
      expect(subscriptions).to.have.length(2);
    } catch (error) {
      if (error.response) {
        console.error('error encountered:  ', error.response.data);
      } else {
        console.error('error encountered:  ', error);
      }
      throw error;
    }
  });

  it('get subscription by subscription uuid', async () => {
    try {
      const result = await subscriptionApi.subscription(token, {
        orgId: org01._id,
        uuid: subscription_01_uuid,
      });
      expect(result.data.errors).to.be.undefined;
      const subscription = result.data.data.subscription;
      expect(subscription.name).to.equal(subscription_01_name);
    } catch (error) {
      if (error.response) {
        console.error('error encountered:  ', error.response.data);
      } else {
        console.error('error encountered:  ', error);
      }
      throw error;
    }
  });

  it('get subscription by subscription name', async () => {
    try {
      const result = await subscriptionApi.subscriptionByName(token, {
        orgId: org01._id,
        name: subscription_01_name,
      });
      expect(result.data.errors).to.be.undefined;
      const subscriptionByName = result.data.data.subscriptionByName;
      expect(subscriptionByName.uuid).to.equal(subscription_01_uuid);
    } catch (error) {
      if (error.response) {
        console.error('error encountered:  ', error.response.data);
      } else {
        console.error('error encountered:  ', error);
      }
      throw error;
    }
  });

  it('get subscriptions by clusterId', async () => {
    try {
      const result = await subscriptionApi.subscriptionsForCluster(adminToken, {
        orgId: org01._id,
        clusterId: 'cluster_01',
      });
      const subscriptionsForCluster = result.data.data.subscriptionsForCluster;
      expect(subscriptionsForCluster[0].uuid).to.equal(subscription_01_uuid);
    } catch (error) {
      if (error.response) {
        console.error('error encountered:  ', error.response.data);
      } else {
        console.error('error encountered:  ', error);
      }
      throw error;
    }
  });

  it('get subscriptions by clusterName', async () => {
    try {
      const result = await subscriptionApi.subscriptionsForClusterByName(adminToken, {
        orgId: org01._id,
        clusterName: 'my-cluster1',
      });
      const subscriptionsForCluster = result.data.data.subscriptionsForClusterByName;
      expect(subscriptionsForCluster[0].uuid).to.equal(subscription_01_uuid);
    } catch (error) {
      if (error.response) {
        console.error('error encountered:  ', error.response.data);
      } else {
        console.error('error encountered:  ', error);
      }
      throw error;
    }
  });

  it('add a subscription', async () => {
    try {
      const {
        data: {
          data: { addSubscription },
        },
      } = await subscriptionApi.addSubscription(adminToken, {
        orgId: org01._id,
        name: 'a_random_name',
        groups:['dev'],
        channelUuid: channel_01_uuid,
        versionUuid: channelVersion_01_uuid,
      });
      expect(addSubscription.uuid).to.be.an('string');

      const addSubscription2 = await subscriptionApi.addSubscription(adminToken, {
        orgId: org01._id,
        name: 'a_random_name2',
        groups:['dev'],
        channelUuid: channel_01_uuid,
        versionUuid: channelVersion_02_uuid,
      });
      expect(addSubscription2.data.errors[0].message).to.equal(`Too many subscriptions are registered under ${org01._id}.`);
    } catch (error) {
      if (error.response) {
        console.error('error encountered:  ', error.response.data);
      } else {
        console.error('error encountered:  ', error);
      }
      throw error;
    }
  });

  it('edit a subscription', async () => {
    try {
      //step1, edit the subscription
      const result = await subscriptionApi.editSubscription(adminToken, {
        orgId: org01._id,
        uuid: subscription_01_uuid,
        name: 'new-name',
        groups:['new-tag'],
        channelUuid: channel_02_uuid,
        versionUuid: channelVersion_03_uuid,
      });
      const {
        data: {
          data: { editSubscription },
        },
      } = result;
      expect(editSubscription.uuid).to.be.an('string');
      expect(editSubscription.success).to.equal(true);
      //step2, get the updated subscription
      const result2 = await subscriptionApi.subscription(adminToken, {
        orgId: org01._id,
        uuid: subscription_01_uuid,
      });
      const {
        data: {
          data: { subscription },
        },
      } = result2;
      expect(subscription.name).to.equal('new-name');
      expect(subscription.channelUuid).to.equal(channel_02_uuid);
      expect(subscription.versionUuid).to.equal(channelVersion_03_uuid);

    } catch (error) {
      if (error.response) {
        console.error('error encountered:  ', error.response.data);
      } else {
        console.error('error encountered:  ', error);
      }
      throw error;
    }
  });

  it('set a subscription configurationVersion', async () => {
    try {
      //step1, edit the subscription's configurationVerision
      const {
        data: {
          data: { setSubscription },
        },
      } = await subscriptionApi.setSubscription(adminToken, {
        orgId: org01._id,
        uuid: subscription_02_uuid,
        versionUuid: channelVersion_01_uuid,
      });
      expect(setSubscription.uuid).to.be.an('string');
      expect(setSubscription.success).to.equal(true);
      //step2, get the updated subscription
      const {
        data: {
          data: { subscription },
        },
      } = await subscriptionApi.subscription(adminToken, {
        orgId: org01._id,
        uuid: subscription_02_uuid,
      });
      expect(subscription.versionUuid).to.equal(channelVersion_01_uuid);

    } catch (error) {
      if (error.response) {
        console.error('error encountered:  ', error.response.data);
      } else {
        console.error('error encountered:  ', error);
      }
      throw error;
    }
  });

  it('remove a subscription', async () => {
    try {
      //step1, remove the subscription
      const {
        data: {
          data: { removeSubscription },
        },
      } = await subscriptionApi.removeSubscriptions(adminToken, {
        orgId: org01._id,
        uuid: subscription_01_uuid,
      });
      expect(removeSubscription.uuid).to.be.an('string');
      expect(removeSubscription.success).to.equal(true);
      //step2, validate the subscription is not there
      const {
        data: {
          data: { subscription },
        },
      } = await subscriptionApi.subscription(adminToken, {
        orgId: org01._id,
        uuid: subscription_01_uuid,
      });
      expect(subscription).to.equal(null);

    } catch (error) {
      if (error.response) {
        console.error('error encountered:  ', error.response.data);
      } else {
        console.error('error encountered:  ', error);
      }
      throw error;
    }
  });
});
