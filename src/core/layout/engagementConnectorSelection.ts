import { ENGAGEMENT_BRANCH_TO_DIRECT_LENGTH_RATIO } from './engagementGeometryConstants';
import type { LayoutPoint } from './types';

type ConnectorParticipant = {
  actorId: string;
  point: LayoutPoint;
};

export type DirectConnectorCandidate<
  TParticipant extends ConnectorParticipant
> = {
  distance: number;
  participant: TParticipant;
  pendingIndex: number;
};

export type BranchConnectorCandidate<
  TParticipant extends ConnectorParticipant
> = DirectConnectorCandidate<TParticipant> & {
  parent: TParticipant;
};

export type EngagementConnectorChoice<
  TParticipant extends ConnectorParticipant
> = DirectConnectorCandidate<TParticipant> & {
  from: LayoutPoint;
  viaActorId?: string;
};

/** Prefers a valid spoke unless the best valid actor branch is much shorter. */
export function chooseEngagementConnector<
  TParticipant extends ConnectorParticipant
>(
  token: LayoutPoint,
  directCandidates: readonly DirectConnectorCandidate<TParticipant>[],
  branchCandidates: readonly BranchConnectorCandidate<TParticipant>[]
): EngagementConnectorChoice<TParticipant> | undefined {
  const directByActorId = new Map(
    directCandidates.map((candidate) => [
      candidate.participant.actorId,
      candidate
    ])
  );
  const branchByActorId = new Map<
    string,
    BranchConnectorCandidate<TParticipant>
  >();

  branchCandidates.forEach((candidate) => {
    const current = branchByActorId.get(candidate.participant.actorId);
    if (
      !current ||
      candidate.distance < current.distance ||
      (candidate.distance === current.distance &&
        candidate.parent.actorId.localeCompare(current.parent.actorId) < 0)
    ) {
      branchByActorId.set(candidate.participant.actorId, candidate);
    }
  });

  return Array.from(
    new Set([...directByActorId.keys(), ...branchByActorId.keys()])
  )
    .flatMap((actorId) => {
      const direct = directByActorId.get(actorId);
      const branch = branchByActorId.get(actorId);
      const useBranch = Boolean(
        branch &&
        (!direct ||
          branch.distance <=
            direct.distance * ENGAGEMENT_BRANCH_TO_DIRECT_LENGTH_RATIO)
      );
      const selected = useBranch ? branch : direct;

      return selected
        ? [
            {
              ...selected,
              from: useBranch ? branch!.parent.point : token,
              ...(useBranch ? { viaActorId: branch!.parent.actorId } : {})
            }
          ]
        : [];
    })
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        left.participant.actorId.localeCompare(right.participant.actorId) ||
        (left.viaActorId ?? '').localeCompare(right.viaActorId ?? '')
    )[0];
}
