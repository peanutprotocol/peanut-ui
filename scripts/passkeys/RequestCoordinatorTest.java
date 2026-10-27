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
        RequestCoordinator<String> coordinator = new RequestCoordinator<>();
        int[] signals = { 0 }, acknowledgements = { 0 };
        RequestCoordinator.Attempt<String> a = coordinator.begin("a", "first", () -> signals[0]++);
        try { coordinator.begin("b", "second", () -> {}); throw new AssertionError("overlap accepted"); }
        catch (IllegalStateException expected) { checks++; }
        check(!coordinator.cancel("wrong", () -> acknowledgements[0]++), "stale cancel must fail");
        check(signals[0] == 0, "stale cancellation has no effect");
        check(coordinator.cancel("a", () -> acknowledgements[0]++), "matching cancellation accepted");
        check(coordinator.cancel("a", () -> acknowledgements[0]++), "replayed cancellation accepted");
        check(signals[0] == 1 && acknowledgements[0] == 0, "cancel marks and signals once, no early acknowledgement");
        check(a.cancelled, "late success must see cancelled state");
        try { coordinator.begin("b", "second", () -> {}); throw new AssertionError("pending cancellation allowed retry"); }
        catch (IllegalStateException expected) { checks++; }
        check(coordinator.complete(a), "first callback completes");
        check(acknowledgements[0] == 2, "terminal callback acknowledges all waiting cancels");
        RequestCoordinator.Attempt<String> b = coordinator.begin("b", "second", () -> {});
        check(!coordinator.complete(a), "duplicate callback ignored");
        check(!coordinator.cancel("a", () -> {}), "old cancellation cannot affect new request");
        check(coordinator.complete(b), "new request survives stale callback");
        check(!b.cancelled, "normal result remains deliverable");
        RequestCoordinator.Attempt<String> legacy = coordinator.begin(null, "legacy", () -> signals[0]++);
        check(!coordinator.cancel(null, () -> {}), "legacy request cannot be canceled by unknown id");
        check(coordinator.complete(legacy), "legacy requests settle normally");

        RequestCoordinator<String> bounded = new RequestCoordinator<>();
        RequestCoordinator.Attempt<String> many = bounded.begin("many", "call", () -> {});
        for (int i = 0; i < 16; i++) check(bounded.cancel("many", () -> {}), "bounded duplicate waiter accepted");
        try { bounded.cancel("many", () -> {}); throw new AssertionError("unbounded waiters accepted"); }
        catch (IllegalStateException expected) { checks++; }
        check(bounded.complete(many), "bounded duplicate cancellation still completes");

        // CancellationSignal.cancel can synchronously dispatch a terminal callback.
        RequestCoordinator<String> synchronous = new RequestCoordinator<>();
        @SuppressWarnings("unchecked") RequestCoordinator.Attempt<String>[] holder = new RequestCoordinator.Attempt[1];
        holder[0] = synchronous.begin("sync", "value", () -> {
            check(holder[0].cancelled, "mark cancellation before signaling");
            check(synchronous.complete(holder[0]), "synchronous callback settles");
        });
        check(synchronous.cancel("sync", () -> acknowledgements[0]++), "synchronous cancel accepted");
        check(acknowledgements[0] == 3, "synchronous cancel acknowledged once");

        RequestCoordinator<String> throwing = new RequestCoordinator<>();
        RequestCoordinator.Attempt<String> uncertain = throwing.begin("throws", "value", () -> { throw new RuntimeException("fault"); });
        check(throwing.cancel("throws", () -> acknowledgements[0]++), "cancel exception remains pending");
        check(uncertain.cancelled && acknowledgements[0] == 3, "signal failure never confirms cleanup");
        check(throwing.complete(uncertain), "later terminal callback reconciles cancel exception");
        check(acknowledgements[0] == 4, "reconciled cancellation acknowledged");

        // Reproducible callback/cancel replay permutations; bounded to 2,000 requests.
        Random random = new Random(23424);
        for (int i = 0; i < 2000; i++) {
            RequestCoordinator<String> subject = new RequestCoordinator<>();
            int[] cancelled = { 0 }, ack = { 0 };
            RequestCoordinator.Attempt<String> request = subject.begin("id_" + i, "call", () -> cancelled[0]++);
            boolean cancelFirst = random.nextBoolean();
            if (cancelFirst) subject.cancel("id_" + i, () -> ack[0]++);
            check(subject.complete(request), "terminal callback wins once");
            for (int replay = 0; replay < 8; replay++) {
                check(!subject.complete(request), "callback replay is inert");
                check(!subject.cancel("id_" + i, () -> ack[0]++), "cancel after terminal is inert");
            }
            check(cancelled[0] == (cancelFirst ? 1 : 0) && ack[0] == cancelled[0], "one cancellation signal and acknowledgement");
        }
        System.out.println("RequestCoordinator: " + checks + " assertions passed; seed=23424, requests=2000");
    }
}
