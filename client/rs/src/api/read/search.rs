use derive_empty_traits::EmptyTraits;
use resolver_api::derive::Request;
use serde::{Deserialize, Serialize};
use typeshare::typeshare;

use crate::entities::{
  build::BuildListItem, deployment::DeploymentListItem,
  procedure::ProcedureListItem, repo::RepoListItem,
  server::ServerListItem, update::ResourceTargetVariant,
  MongoDocument,
};

use super::MonitorReadRequest;

//

#[typeshare]
#[derive(
  Serialize, Deserialize, Debug, Clone, Default, Request, EmptyTraits,
)]
#[empty_traits(MonitorReadRequest)]
#[response(FindResourcesResponse)]
pub struct FindResources {
  #[serde(default)]
  pub query: MongoDocument,
  #[serde(default)]
  pub resources: Vec<ResourceTargetVariant>,
}

#[typeshare]
#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct FindResourcesResponse {
  pub servers: Vec<ServerListItem>,
  pub deployments: Vec<DeploymentListItem>,
  pub builds: Vec<BuildListItem>,
  pub repos: Vec<RepoListItem>,
  pub procedures: Vec<ProcedureListItem>,
}
