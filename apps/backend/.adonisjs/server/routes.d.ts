import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'auth.new_account.store': { paramsTuple?: []; params?: {} }
    'auth.login.store': { paramsTuple?: []; params?: {} }
    'auth.csrf': { paramsTuple?: []; params?: {} }
    'profile.profile.show': { paramsTuple?: []; params?: {} }
    'profile.login.destroy': { paramsTuple?: []; params?: {} }
    'game.scenarios.index': { paramsTuple?: []; params?: {} }
    'game.sessions.index': { paramsTuple?: []; params?: {} }
    'game.sessions.store': { paramsTuple?: []; params?: {} }
    'game.sessions.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'game.turns.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'game.turns.show': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'turnId': ParamValue} }
    'game.turns.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.worlds.index': { paramsTuple?: []; params?: {} }
    'admin.worlds.store': { paramsTuple?: []; params?: {} }
    'admin.worlds.show': { paramsTuple: [ParamValue]; params: {'worldId': ParamValue} }
    'admin.worlds.update': { paramsTuple: [ParamValue]; params: {'worldId': ParamValue} }
    'admin.worlds.destroy': { paramsTuple: [ParamValue]; params: {'worldId': ParamValue} }
    'admin.action_types.index': { paramsTuple: [ParamValue]; params: {'worldId': ParamValue} }
    'admin.action_types.store': { paramsTuple: [ParamValue]; params: {'worldId': ParamValue} }
    'admin.action_types.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.action_types.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.scenarios.index': { paramsTuple: [ParamValue]; params: {'worldId': ParamValue} }
    'admin.scenarios.store': { paramsTuple: [ParamValue]; params: {'worldId': ParamValue} }
    'admin.scenarios.show': { paramsTuple: [ParamValue]; params: {'scenarioId': ParamValue} }
    'admin.scenarios.update': { paramsTuple: [ParamValue]; params: {'scenarioId': ParamValue} }
    'admin.scenarios.destroy': { paramsTuple: [ParamValue]; params: {'scenarioId': ParamValue} }
    'admin.scenarios.publish': { paramsTuple: [ParamValue]; params: {'scenarioId': ParamValue} }
    'admin.scenarios.unpublish': { paramsTuple: [ParamValue]; params: {'scenarioId': ParamValue} }
    'admin.definitions.world.index': { paramsTuple: [ParamValue,ParamValue]; params: {'worldId': ParamValue,'catalogue': ParamValue} }
    'admin.definitions.world.store': { paramsTuple: [ParamValue,ParamValue]; params: {'worldId': ParamValue,'catalogue': ParamValue} }
    'admin.definitions.scenario.index': { paramsTuple: [ParamValue,ParamValue]; params: {'scenarioId': ParamValue,'catalogue': ParamValue} }
    'admin.definitions.scenario.store': { paramsTuple: [ParamValue,ParamValue]; params: {'scenarioId': ParamValue,'catalogue': ParamValue} }
    'admin.definitions.update': { paramsTuple: [ParamValue,ParamValue]; params: {'catalogue': ParamValue,'definitionId': ParamValue} }
    'admin.definitions.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'catalogue': ParamValue,'definitionId': ParamValue} }
    'admin.accounts.accounts.index': { paramsTuple?: []; params?: {} }
    'admin.accounts.accounts.store': { paramsTuple?: []; params?: {} }
    'admin.accounts.accounts.suspend': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'admin.accounts.accounts.reactivate': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'auth.csrf': { paramsTuple?: []; params?: {} }
    'profile.profile.show': { paramsTuple?: []; params?: {} }
    'game.scenarios.index': { paramsTuple?: []; params?: {} }
    'game.sessions.index': { paramsTuple?: []; params?: {} }
    'game.sessions.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'game.turns.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'game.turns.show': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'turnId': ParamValue} }
    'admin.worlds.index': { paramsTuple?: []; params?: {} }
    'admin.worlds.show': { paramsTuple: [ParamValue]; params: {'worldId': ParamValue} }
    'admin.action_types.index': { paramsTuple: [ParamValue]; params: {'worldId': ParamValue} }
    'admin.scenarios.index': { paramsTuple: [ParamValue]; params: {'worldId': ParamValue} }
    'admin.scenarios.show': { paramsTuple: [ParamValue]; params: {'scenarioId': ParamValue} }
    'admin.definitions.world.index': { paramsTuple: [ParamValue,ParamValue]; params: {'worldId': ParamValue,'catalogue': ParamValue} }
    'admin.definitions.scenario.index': { paramsTuple: [ParamValue,ParamValue]; params: {'scenarioId': ParamValue,'catalogue': ParamValue} }
    'admin.accounts.accounts.index': { paramsTuple?: []; params?: {} }
    'event_stream': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'auth.csrf': { paramsTuple?: []; params?: {} }
    'profile.profile.show': { paramsTuple?: []; params?: {} }
    'game.scenarios.index': { paramsTuple?: []; params?: {} }
    'game.sessions.index': { paramsTuple?: []; params?: {} }
    'game.sessions.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'game.turns.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'game.turns.show': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'turnId': ParamValue} }
    'admin.worlds.index': { paramsTuple?: []; params?: {} }
    'admin.worlds.show': { paramsTuple: [ParamValue]; params: {'worldId': ParamValue} }
    'admin.action_types.index': { paramsTuple: [ParamValue]; params: {'worldId': ParamValue} }
    'admin.scenarios.index': { paramsTuple: [ParamValue]; params: {'worldId': ParamValue} }
    'admin.scenarios.show': { paramsTuple: [ParamValue]; params: {'scenarioId': ParamValue} }
    'admin.definitions.world.index': { paramsTuple: [ParamValue,ParamValue]; params: {'worldId': ParamValue,'catalogue': ParamValue} }
    'admin.definitions.scenario.index': { paramsTuple: [ParamValue,ParamValue]; params: {'scenarioId': ParamValue,'catalogue': ParamValue} }
    'admin.accounts.accounts.index': { paramsTuple?: []; params?: {} }
    'event_stream': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'auth.new_account.store': { paramsTuple?: []; params?: {} }
    'auth.login.store': { paramsTuple?: []; params?: {} }
    'profile.login.destroy': { paramsTuple?: []; params?: {} }
    'game.sessions.store': { paramsTuple?: []; params?: {} }
    'game.turns.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.worlds.store': { paramsTuple?: []; params?: {} }
    'admin.action_types.store': { paramsTuple: [ParamValue]; params: {'worldId': ParamValue} }
    'admin.scenarios.store': { paramsTuple: [ParamValue]; params: {'worldId': ParamValue} }
    'admin.scenarios.publish': { paramsTuple: [ParamValue]; params: {'scenarioId': ParamValue} }
    'admin.scenarios.unpublish': { paramsTuple: [ParamValue]; params: {'scenarioId': ParamValue} }
    'admin.definitions.world.store': { paramsTuple: [ParamValue,ParamValue]; params: {'worldId': ParamValue,'catalogue': ParamValue} }
    'admin.definitions.scenario.store': { paramsTuple: [ParamValue,ParamValue]; params: {'scenarioId': ParamValue,'catalogue': ParamValue} }
    'admin.accounts.accounts.store': { paramsTuple?: []; params?: {} }
    'admin.accounts.accounts.suspend': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'admin.accounts.accounts.reactivate': { paramsTuple: [ParamValue]; params: {'accountId': ParamValue} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
  }
  PATCH: {
    'admin.worlds.update': { paramsTuple: [ParamValue]; params: {'worldId': ParamValue} }
    'admin.action_types.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.scenarios.update': { paramsTuple: [ParamValue]; params: {'scenarioId': ParamValue} }
    'admin.definitions.update': { paramsTuple: [ParamValue,ParamValue]; params: {'catalogue': ParamValue,'definitionId': ParamValue} }
  }
  DELETE: {
    'admin.worlds.destroy': { paramsTuple: [ParamValue]; params: {'worldId': ParamValue} }
    'admin.action_types.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.scenarios.destroy': { paramsTuple: [ParamValue]; params: {'scenarioId': ParamValue} }
    'admin.definitions.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'catalogue': ParamValue,'definitionId': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}