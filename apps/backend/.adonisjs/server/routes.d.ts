import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'auth.new_account.store': { paramsTuple?: []; params?: {} }
    'auth.login.store': { paramsTuple?: []; params?: {} }
    'auth.csrf': { paramsTuple?: []; params?: {} }
    'profile.profile.show': { paramsTuple?: []; params?: {} }
    'profile.login.destroy': { paramsTuple?: []; params?: {} }
    'game.sessions.index': { paramsTuple?: []; params?: {} }
    'game.sessions.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'game.turns.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'game.turns.show': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'turnId': ParamValue} }
    'game.turns.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'auth.csrf': { paramsTuple?: []; params?: {} }
    'profile.profile.show': { paramsTuple?: []; params?: {} }
    'game.sessions.index': { paramsTuple?: []; params?: {} }
    'game.sessions.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'game.turns.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'game.turns.show': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'turnId': ParamValue} }
    'event_stream': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'auth.csrf': { paramsTuple?: []; params?: {} }
    'profile.profile.show': { paramsTuple?: []; params?: {} }
    'game.sessions.index': { paramsTuple?: []; params?: {} }
    'game.sessions.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'game.turns.index': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'game.turns.show': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'turnId': ParamValue} }
    'event_stream': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'auth.new_account.store': { paramsTuple?: []; params?: {} }
    'auth.login.store': { paramsTuple?: []; params?: {} }
    'profile.login.destroy': { paramsTuple?: []; params?: {} }
    'game.turns.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}