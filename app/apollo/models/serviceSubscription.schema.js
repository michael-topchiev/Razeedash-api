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

const mongoose = require('mongoose');

const ServiceSubscriptionSchema = new mongoose.Schema({
  _id: {
    type: String,
  },
  org_id: {
    type: String,
    alias: 'orgId',
  },
  clusterOrgId: {
    type: String,
  },
  name: {
    type: String,
  },
  uuid: {
    type: String,
  },
  groups: [
    {
      type: String,
    }
  ],
  clusterId: {
    type: String,
  },
  channel_uuid: {
    type: String,
    alias: 'channelUuid',
  },
  channelName: {
    type: String,
  },
  version: {
    type: String,
  },
  version_uuid: {
    type: String,
    alias: 'versionUuid',
  },
  owner: {
    type: String,
  },
  kubeOwnerName: {
    type: String,
  },
  kubeOwnerId: {
    type: String,
  },
  created: {
    type: Date,
    default: Date.now,
  },
  updated: {
    type: Date,
    default: Date.now,
  },
}, {
  collection: 'serviceSubscriptions',
  strict:'throw',
});

ServiceSubscriptionSchema.index({ version_uuid: 1 });
ServiceSubscriptionSchema.index({ org_id: 1 });

module.exports = ServiceSubscriptionSchema;
