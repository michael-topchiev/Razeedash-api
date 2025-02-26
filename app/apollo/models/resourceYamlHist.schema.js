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

const ResourceYamlHistSchema = new mongoose.Schema({
  _id:{
    type: String,
    alias: 'id',
  },
  org_id: {
    type: String,
  },
  cluster_id: {
    type: String,
  },
  resourceSelfLink: {
    type: String,
  },
  yamlStr: mongoose.Schema.Types.Mixed,
  updated: {
    type: Date,
    default: Date.now,
  },
}, {
  strict:'throw',
});

module.exports = ResourceYamlHistSchema;

