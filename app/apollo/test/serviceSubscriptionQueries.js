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

const axios = require('axios');

const queries = grahqlUrl => {

  const addServiceSubscription = async (token, variables) =>
    axios.post(
      grahqlUrl,
      {
        query: `
          mutation($orgId: String!, $name: String!, $clusterId: String!, $channelUuid: String!, $versionUuid: String!) {
            addServiceSubscription(orgId: $orgId, name: $name, clusterId: $clusterId, channelUuid: $channelUuid, versionUuid: $versionUuid)
          }  `,
        variables,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

  const subscriptionType = async (token, variables) =>
    axios.post(
      grahqlUrl,
      {
        query: `
          query  ($orgId: String!, $id: ID!) {
            subscriptionType(orgId: $orgId, id: $id) 
          } `,
        variables,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

  const serviceSubscriptions = async (token, variables) =>
    axios.post(
      grahqlUrl,
      {
        query: `
          query  ($orgId:  String!) {
            serviceSubscriptions(orgId: $orgId) {
              ssid
              versionUuid
            }
          } `,
        variables,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

  const allSubscriptions = async (token, variables) =>
    axios.post(
      grahqlUrl,
      {
        query: `
        query ($orgId: String!) {
          subscriptions: allSubscriptions(orgId: $orgId) {
            ... on ServiceSubscription {
              uuid: ssid
              subscriptionType: __typename
              remoteResources {
                cluster {
                  clusterId
                }
              }
            }
            ... on ChannelSubscription {
              uuid
              subscriptionType: __typename
              remoteResources {
                cluster {
                  clusterId
                }
              }
            }
          }
        } `,
        variables,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

  const serviceSubscription = async (token, variables) =>
    axios.post(
      grahqlUrl,
      {
        query: `
            query  ($orgId: String!, $ssid: String!) {
              serviceSubscription(orgId: $orgId, ssid: $ssid) {
                ssid
                versionUuid
                owner {
                  id
                  name
                }
              }
            } `,
        variables,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

  const editServiceSubscription = async (token, variables) =>
    axios.post(
      grahqlUrl,
      {
        query: `
        mutation ($orgId: String!, $ssid: String!  $name: String!, $channelUuid: String!, $versionUuid: String!) {
          editServiceSubscription(orgId: $orgId, ssid: $ssid, name: $name, channelUuid: $channelUuid, versionUuid: $versionUuid)
        } `,
        variables,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

  const removeServiceSubscription = async (token, variables) =>
    axios.post(
      grahqlUrl,
      {
        query: `
        mutation ($orgId: String!, $ssid:  ID!) {
          removeServiceSubscription(orgId: $orgId, ssid: $ssid)
        } `,
        variables,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

  const removeChannelVersion = async (token, variables) =>
    axios.post(
      grahqlUrl,
      {
        query: `
        mutation ($orgId:  String!,  $uuid: String! ) {
          removeChannelVersion(orgId: $orgId, uuid: $uuid ){
            uuid
            success
          }
        } `,
        variables,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

  return {
    addServiceSubscription,
    subscriptionType,
    serviceSubscriptions,
    serviceSubscription,
    editServiceSubscription,
    removeServiceSubscription,
    allSubscriptions,
    removeChannelVersion
  };
};

module.exports = queries;
