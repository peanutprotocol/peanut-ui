package app.capgo.passkey;

import java.util.Random;

/** Pure state-machine tests: no Android runtime or provider is involved. */
public final class RequestCoordinatorTest {
    private static int checks;
    private static void check(boolean value, String description) {
        checks++;
        if (!value) throw new AssertionError(description);
    }
    public static void main(String[] args) {
        for (String invalid : new String[] { "", "a b", "💥", "a/b", "a".repeat(65) }) {
            try { new RequestCoordinator<String>().begin(invalid, "call", () -> {}); throw new AssertionError("invalid id accepted"); }
            catch (IllegalArgumentException expected) { checks++; }
        }
        long[] now = { 1_000 };
        RequestCoordinator<String> coordinator = new RequestCoordinator<>(() -> now[0]);
        int[] signals = { 0 };
        RequestCoordinator.Attempt<String> a = coordinator.begin("a", "first", () -> signals[0]++);
        try { coordinator.begin("b", "second", () -> {}); throw new AssertionError("overlap with a live request accepted"); }
        catch (IllegalStateException expected) { checks++; }
        check(coordinator.cancel("wrong") == null, "stale cancel must fail");
        check(signals[0] == 0 && !a.cancelled, "stale cancellation has no effect");
        check(coordinator.cancel("a") == a, "matching cancellation releases the attempt");
        check(signals[0] == 1 && a.cancelled, "cancel marks and signals once");
        check(coordinator.cancel("a") == null, "replayed cancellation is inert");
        check(signals[0] == 1, "replayed cancellation does not signal again");
        check(coordinator.releasedOnCancel() == 1, "release counted");

        // Provider never acknowledges: a new request still begins at once.
        RequestCoordinator.Attempt<String> b = coordinator.begin("b", "second", () -> signals[0]++);
        check(coordinator.cancel("a") == null && !b.cancelled, "old id cannot cancel the newer request");
        now[0] = 485_000;
        check(!coordinator.complete(a), "late success of the released attempt is dropped");
        check(coordinator.lateCallbacks() == 1 && coordinator.lastLateCallbackMs() == 484_000, "late callback counted with its delay");
        check(!coordinator.complete(a), "duplicate late callback ignored");
        check(coordinator.lateCallbacks() == 1, "duplicate late callback not double counted");
        try { coordinator.begin("c", "third", () -> {}); throw new AssertionError("late callback freed the newer request's slot"); }
        catch (IllegalStateException expected) { checks++; }
        check(coordinator.complete(b), "new request survives the stale callback");
        check(!b.cancelled, "normal result remains deliverable");
        check(coordinator.cancel("b") == null, "cancel after terminal is inert");

        RequestCoordinator.Attempt<String> legacy = coordinator.begin(null, "legacy", () -> signals[0]++);
        check(coordinator.cancel(null) == null, "legacy request cannot be canceled by unknown id");
        check(coordinator.complete(legacy), "legacy requests settle normally");

        // CancellationSignal.cancel can synchronously dispatch a terminal callback.
        RequestCoordinator<String> synchronous = new RequestCoordinator<>(() -> 0);
        @SuppressWarnings("unchecked") RequestCoordinator.Attempt<String>[] holder = new RequestCoordinator.Attempt[1];
        holder[0] = synchronous.begin("sync", "value", () -> {
            check(holder[0].cancelled, "mark cancellation before signaling");
            check(!synchronous.complete(holder[0]), "synchronous callback is dropped, the cancel answers JS");
        });
        check(synchronous.cancel("sync") == holder[0], "synchronous cancel accepted");
        check(synchronous.begin("next", "value", () -> {}) != null, "slot free after a synchronous callback");

        RequestCoordinator<String> throwing = new RequestCoordinator<>();
        RequestCoordinator.Attempt<String> uncertain = throwing.begin("throws", "value", () -> { throw new RuntimeException("fault"); });
        check(throwing.cancel("throws") == uncertain, "cancel exception still releases");
        check(uncertain.cancelled, "attempt marked cancelled despite signal failure");
        check(throwing.begin("after", "value", () -> {}) != null, "slot free after a failed signal");
        check(!throwing.complete(uncertain), "later callback of the failed-signal attempt is dropped");

        // Reproducible permutations: old callback before/after a new request, success or failure, replays.
        Random random = new Random(23424);
        for (int i = 0; i < 2000; i++) {
            RequestCoordinator<String> subject = new RequestCoordinator<>();
            int[] cancelled = { 0 };
            String oldId = "old_" + i, newId = "new_" + i;
            RequestCoordinator.Attempt<String> old = subject.begin(oldId, "old", () -> cancelled[0]++);
            boolean cancelOld = random.nextBoolean();
            if (!cancelOld) {
                check(subject.complete(old), "uncancelled terminal callback wins once");
                for (int replay = 0; replay < 4; replay++) check(!subject.complete(old), "callback replay is inert");
                check(subject.cancel(oldId) == null && cancelled[0] == 0, "cancel after terminal is inert");
                continue;
            }
            check(subject.cancel(oldId) == old && cancelled[0] == 1, "one cancellation signal");
            boolean lateBeforeNew = random.nextBoolean();
            if (lateBeforeNew) check(!subject.complete(old), "late callback before the next request is dropped");
            RequestCoordinator.Attempt<String> next = subject.begin(newId, "new", () -> {});
            int replays = random.nextInt(4);
            for (int replay = 0; replay < replays; replay++) {
                check(!subject.complete(old), "late callback during the next request is dropped");
                check(subject.cancel(oldId) == null, "stale cancel during the next request is inert");
            }
            check(!next.cancelled, "newer request untouched by the old one");
            check(subject.complete(next), "newer request settles once");
            check(subject.lateCallbacks() <= 1, "late callbacks counted once per attempt");
        }
        System.out.println("RequestCoordinator: " + checks + " assertions passed; seed=23424, requests=2000");
    }
}
