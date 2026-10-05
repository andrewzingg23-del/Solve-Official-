// Every repository pairing this deployment knows: the ones committed in solve.rooms.json, and any set
// where the app is deployed (GITHUB_ROOMS). Server only.
import file from "@/solve.rooms.json";
import { roomRepos, roomsFromFile, type RepoRef } from "./repo";

export function deploymentRooms(env: string | undefined = process.env.GITHUB_ROOMS): Map<string, RepoRef> {
  return new Map([...roomsFromFile(file), ...roomRepos(env)]);
}
