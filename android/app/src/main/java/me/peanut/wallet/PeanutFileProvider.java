package me.peanut.wallet;

import androidx.core.content.FileProvider;

/*
 * Distinct manifest merge key for the app's own FileProvider entry. The merger
 * keys <provider> nodes by android:name, so declaring the androidx class
 * directly collided with the Crisp SDK's provider and the old tools:replace
 * "fix" silently stripped Crisp's upload authority — crashing "Take a photo"
 * in support chat. An empty subclass lets both providers coexist.
 */
public class PeanutFileProvider extends FileProvider {}
